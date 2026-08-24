---
title: '검색엔진에 335페이지가 투명인간이었다 — 사이드 프로젝트 SEO 기반 구축 실전'
date: '2026-07-13'
publish_date: '2026-08-25'
description: 방 목록이 클라이언트 fetch면 크롤러는 링크를 발견하지 못한다 — Next.js robots.ts/sitemap.ts 파일 컨벤션부터 시한부 페이지 noindex, JSON-LD까지 SEO 기반 공사 기록
tags:
  - SEO
  - Next.js
  - sitemap
  - JSON-LD
  - 구조화 데이터
---

커스텀 도메인도 연결했고, OG 이미지도 예쁘게 만들었고, 이제 검색만 되면 됩니다. 그래서 확인해봤습니다:

```bash
curl https://nogari.org/robots.txt    # → 404 페이지
curl https://nogari.org/sitemap.xml   # → 404
```

**둘 다 없었습니다.** 더 심각한 건 그다음이었어요. 제 사이드 프로젝트에는 게시판(방)이 335개 있는데 — 국회의원 300명 방을 시드해뒀거든요 — 크롤러 입장에서 이 335페이지에 도달할 방법이 **하나도 없다**는 걸 깨달았습니다.

## 왜 크롤러는 내 콘텐츠를 못 찾는가

홈 화면에는 방 목록이 잘 보입니다. 그런데 이 목록은 클라이언트 컴포넌트가 `fetch("/api/topics/...")`로 그리는 화면입니다. 크롤러가 받아가는 HTML에는 **방으로 가는 `<a>` 태그가 없습니다.**

검색엔진이 페이지를 색인하는 경로는 기본적으로 두 가지입니다:

1. 아는 페이지의 HTML에서 링크를 따라간다
2. 사이트맵에 적힌 URL을 방문한다

1번이 막혀 있으니(링크가 JS 실행 후에야 생김), 2번 사이트맵이 없으면 방 상세 페이지들은 **존재 자체가 알려지지 않습니다**. 방 상세는 SSR이라 댓글까지 HTML에 담겨 나오는, 색인되면 잘 팔릴 페이지인데도요. 개별 페이지의 SEO 품질보다 **발견 가능성(discoverability)**이 먼저라는 걸 이번에 몸으로 배웠습니다.

## Step 1 — robots.ts: 파일 하나로 끝

Next.js App Router는 `app/robots.ts`를 만들면 `/robots.txt`를 자동 생성합니다:

```ts
// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/"],   // 관리자·API는 크롤링 제외
    },
    sitemap: "https://nogari.org/sitemap.xml",
  };
}
```

robots.txt가 아예 없어도 크롤링은 됩니다만, 사이트맵 위치를 알려주는 표준 통로이자 관리자 페이지 같은 곳의 크롤링을 막는 최소한의 교통정리라 만들어두는 게 맞습니다.

## Step 2 — sitemap.ts: DB에서 URL을 뽑아 동적 생성

핵심입니다. `app/sitemap.ts`에서 DB를 조회해 사이트맵을 동적으로 만들 수 있습니다:

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

const BASE_URL = "https://nogari.org";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/proposals`, changeFrequency: "daily", priority: 0.6 },
  ];

  const admin = createAdminClient();
  const { data: topics } = await admin
    .from("topics")
    .select("id, last_comment_at, activated_at")
    .eq("status", "ACTIVE")            // 살아있는 방만
    .order("last_comment_at", { ascending: false, nullsFirst: false })
    .limit(5000);

  const topicPages = (topics ?? []).map((t) => ({
    url: `${BASE_URL}/topics/${t.id}`,
    lastModified: t.last_comment_at ?? t.activated_at ?? undefined,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...topicPages];
}
```

포인트:

- **`lastModified`에 마지막 댓글 시각**을 넣었습니다. 커뮤니티에서 "페이지가 언제 갱신됐나"는 곧 "마지막 대화가 언제였나"니까요. 크롤러가 활발한 방을 더 자주 다시 방문하게 됩니다.
- **ACTIVE 방만** 넣습니다. 이유는 Step 3에서.

배포 후 `/sitemap.xml`을 열면 335개 URL이 정직하게 나열됩니다. 이 파일이 생기는 순간, 클라이언트 렌더링 뒤에 숨어 있던 모든 방이 검색엔진에 "존재를 신고"하게 됩니다.

## Step 3 — 시한부 페이지는 noindex: 소프트 404 예방

제 서비스에는 특이한 페이지가 있습니다. **72시간 안에 30명이 동의하면 열리고, 못 모으면 사라지는** 개설 대기중 방. 그리고 만료된 방.

이런 페이지가 색인되면 어떻게 될까요? 검색 결과를 타고 왔는데 "만료된 방입니다"가 뜹니다. 구글은 이런 걸 **소프트 404**로 분류하고, 쌓이면 사이트 전체의 품질 평가에 악영향을 줍니다. 그래서 상태에 따라 색인 여부를 갈랐습니다:

```ts
// app/topics/[id]/page.tsx — generateMetadata
return {
  title,
  description,
  alternates: { canonical: `/topics/${id}` },
  // PENDING(72시간 시한부)·EXPIRED는 곧 사라질 페이지 — 색인 금지
  robots: topic.status === "ACTIVE" ? undefined : { index: false },
};
```

공유는 되지만(OG는 그대로) 색인은 안 되는 상태. "친구에게 보내는 링크"와 "검색에 남는 페이지"는 다른 수명을 가져야 합니다.

`canonical`도 함께 넣었습니다. 저처럼 Vercel을 쓰면 `프로젝트명.vercel.app`으로도 같은 페이지가 열리는데, canonical이 없으면 검색엔진이 두 주소를 별개 페이지로 취급해 평가가 분산될 수 있습니다.

## Step 4 — JSON-LD: "이건 토론 게시글이야"라고 알려주기

검색엔진은 HTML만 보고 "이 페이지가 뭔지"를 추측하는데, 구조화 데이터(JSON-LD)를 주면 추측이 확신이 됩니다. 커뮤니티 스레드에는 `DiscussionForumPosting` 타입이 있습니다:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "DiscussionForumPosting",
      headline: `${topic.title} 노가리방`,
      url: `https://nogari.org/topics/${topic.id}`,
      datePublished: topic.activated_at,
      commentCount: comments.length,
      isPartOf: { "@type": "WebSite", name: "노가리", url: "https://nogari.org" },
    }),
  }}
/>
```

구글은 포럼·커뮤니티 콘텐츠를 별도 UI(Discussions and forums)로 노출하기도 해서, 커뮤니티 서비스라면 넣어둘 가치가 충분합니다. 검증은 [Rich Results Test](https://search.google.com/test/rich-results)에 URL을 넣으면 됩니다.

## Step 5 — 코드로 안 되는 것: 서치콘솔 등록

여기까지가 코드의 몫이고, 나머지는 발품입니다:

| 할 일 | 왜 |
|---|---|
| [Google Search Console](https://search.google.com/search-console) 등록 + 사이트맵 제출 | 등록 없이 기다리면 색인이 몇 주씩 늦어짐. 색인 현황·검색어 데이터도 여기서만 봄 |
| [네이버 서치어드바이저](https://searchadvisor.naver.com) 등록 | **한국 서비스면 필수.** 인물·이슈 검색은 네이버 비중이 크고, 네이버는 등록 안 하면 정말 안 긁어감 |

둘 다 소유 확인 메타태그를 발급해주는데, Next.js에서는 `metadata.verification`에 넣으면 됩니다:

```ts
export const metadata: Metadata = {
  verification: {
    google: "구글이_준_코드",
    other: { "naver-site-verification": "네이버가_준_코드" },
  },
};
```

## 정리

1. **발견 가능성이 페이지 품질보다 먼저다** — 목록이 클라이언트 렌더링이면 크롤러는 링크를 못 본다. 사이트맵이 유일한 색인 경로가 된다
2. **robots.ts / sitemap.ts** — 파일 컨벤션 하나로 자동 생성, 사이트맵은 DB 조회로 동적 구성
3. **lastModified는 서비스의 "갱신"에 맞게** — 커뮤니티라면 마지막 댓글 시각
4. **수명 짧은 페이지는 noindex** — 시한부·만료 페이지가 색인되면 소프트 404가 쌓인다
5. **canonical로 중복 주소 정리** — vercel.app 별칭이 있다면 특히
6. **JSON-LD로 페이지의 정체를 선언** — 커뮤니티는 DiscussionForumPosting
7. **서치콘솔·서치어드바이저 등록은 코드 밖의 필수 작업**

가장 큰 교훈은 이겁니다. SEO라고 하면 메타태그나 키워드부터 떠올리기 쉬운데, 제 사이트의 진짜 문제는 **335페이지가 아예 발견될 수 없는 구조**였다는 것. 지도를 그려주기 전까지, 검색엔진에게 그 페이지들은 존재하지 않는 거나 마찬가지였습니다.
