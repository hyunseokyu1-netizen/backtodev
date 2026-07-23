---
title: 'Deploying a Free pages.dev Domain on Cloudflare Pages — How to Avoid the Workers Screen Bait-and-Switch'
date: '2026-07-23'
description: Click Create application and you get a Worker creation screen, not Pages. The full process of hunting down the hidden Pages entry point and shipping a static Next.js site on a free domain
tags:
  - Cloudflare
  - Cloudflare Pages
  - Next.js
  - Deployment
  - GitHub
---

## Why Cloudflare Pages

I built a small web game for my kids. It was running at first on a temporary address my dev tool had automatically attached, and the address looked like this.

```
kidsplay-little-playground.hyunseok-yu1.chatgpt.site
```

49 characters. Too embarrassing to send my wife over KakaoTalk, and it required a login on top of that. Bookmarking it on the kids' device would've been fine on its own, but I wanted something short and login-free while I was at it.

Buying a domain felt like overkill. Paying a yearly domain fee for a personal project didn't sit right with me. So I went looking for hosting that gives out a **free subdomain**, and compared a few options.

| Service | Free address | Bandwidth | Commercial use |
|---|---|---|---|
| **Cloudflare Pages** | `name.pages.dev` | Unlimited | Allowed |
| Vercel | `name.vercel.app` | 100GB/mo | Not on the free plan |
| Netlify | `name.netlify.app` | 100GB/mo | Allowed |
| GitHub Pages | `username.github.io/repo-name` | Soft 100GB/mo | Allowed |

I went with Cloudflare Pages for three reasons.

1. **Unlimited bandwidth.** No monthly transfer cap on the free plan, so no worrying about a surprise bill if a personal project suddenly gets traffic.
2. **Short address.** GitHub Pages actually ends up longer, with `username.github.io/repo-name`.
3. **Global CDN.** CDN is literally Cloudflare's core business. First load on my kid's tablet is noticeably fast.

But once I actually tried it, **the biggest obstacle turned out to be the Cloudflare dashboard UI, not the technology.** This post is the full process, traps included.

## Prerequisites

- Code already pushed to a GitHub repo
- A Cloudflare account (free signup)
- A project that builds down to static files

The third one matters. Cloudflare Pages is, at its core, **static file hosting.** Things get complicated fast if you need server-side rendering. In my case, all the game logic runs client-side in the browser, so a static build was more than enough.

## Step 1. Build Next.js as Static Files

Next.js runs a server by default, so getting static output requires the `output: "export"` setting.

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const isCloudflarePagesBuild = process.env.CLOUDFLARE_PAGES_BUILD === "1";

const nextConfig: NextConfig = {
  output: isCloudflarePagesBuild ? "export" : undefined,
  images: isCloudflarePagesBuild ? { unoptimized: true } : undefined,
};

export default nextConfig;
```

**There's a reason I branched this on an environment variable.** Leaving `output: "export"` on all the time restricts features you'd otherwise have in local dev. So the flag only flips on for the Cloudflare build.

`images: { unoptimized: true }` is also required. Next.js image optimization **transforms images on the server at runtime.** That can't work on a static deploy with no server — skip this option and the build fails outright.

I added a dedicated build script in `package.json`.

```json
{
  "scripts": {
    "build": "next build",
    "build:pages": "CLOUDFLARE_PAGES_BUILD=1 next build"
  }
}
```

Run it locally first.

```bash
npm run build:pages
```

On success, an `out/` directory shows up at the project root. Make sure `index.html` is actually in there.

```bash
ls out/
# index.html  _next/  favicon.svg  manifest.webmanifest  sw.js ...
```

**Confirming this locally matters.** A build that fails locally will fail on Cloudflare too. Debugging through cloud build logs is a lot more frustrating when each run costs you a minute or two.

## Step 2. This Is Where Everyone Gets Fooled Once

Now head to the Cloudflare dashboard. Go to **Compute → Workers & Pages** in the left sidebar, and there's a blue **Create application** button in the top right. Naturally, you click it.

And here's the screen that shows up.

```
                        Create a Worker

              ┌─────────────────────────────────┐
              │  Ship something new             │
              │                                 │
              │  [🐙 Continue with GitHub  →]   │
              │  [🦊 Connect GitLab        ]    │
              │  [🌐 Start with Hello World!]   │
              │  [🧭 Select a template      ]   │
              │  [📁 Upload your static files]  │
              └─────────────────────────────────┘

           Looking to deploy Pages?  Get started
```

**The title says "Create a Worker." Not Pages.**

Clicking `Continue with GitHub` here brings up a screen for connecting a GitHub repo, and it looks like things are going fine. But go through with it and **you end up with a Worker project, not a Pages project.** The resulting address looks like this.

```
project-name.your-account-subdomain.workers.dev
```

On my account it comes out as something like `repotape.backdev.workers.dev`. Not `pages.dev`. And the account subdomain (`backdev`) gets stuffed in the middle, making the address one segment longer.

To actually get Pages, you have to find the **small gray text at the very bottom of the screen.**

> Looking to deploy Pages? **Get started**

You need to click that `Get started` link to land on the Pages side. It sits below the big central cards, tucked away where it's easy to miss.

### Why It's Set Up This Way

Cloudflare is moving toward merging Workers and Pages. New projects get funneled toward Workers (which now includes static asset hosting), while Pages is drifting closer to maintenance mode.

Which raises a question: **why not just use Workers, then?**

| Item | Cloudflare Pages | Workers (Static Assets) |
|---|---|---|
| Free address | `name.pages.dev` | `name.account-subdomain.workers.dev` |
| Address length | Short | Longer, account subdomain included |
| PR preview comments | Automatic | None |
| Static site setup | A few clicks | Requires `wrangler.toml` config |
| Server logic | Not available (Functions is separate) | Fully available |

**If the goal is a short address for a static site, Pages is still the better choice.** The address is shorter, there's less to configure, and a bot automatically comments a preview URL on every PR. If server logic becomes necessary later, moving to Workers then is still an option.

## Step 3. Finding the Pages Entry Point

Clicking `Get started` finally reveals the Pages screen.

```
                          Get started
             Get started with Pages. How would you like to begin?

    ┌────────────────────────────────────────────────────────┐
    │ 🔀 Import an existing Git repository    [Get started]  │
    │    Start by importing an existing Git repository.      │
    ├────────────────────────────────────────────────────────┤
    │ ☁️  Drag and drop your files            [Get started]  │
    │    Upload your site's assets including HTML, CSS, JS.  │
    └────────────────────────────────────────────────────────┘
```

There are two options.

- **Import an existing Git repository** — connect a GitHub/GitLab repo. Auto-redeploys on push.
- **Drag and drop your files** — just drop a built folder in. No Git integration.

The second option is genuinely simple, but every code change means manually rebuilding and re-uploading. **Unless this is truly a one-off, Git integration is strongly recommended.** I went with the first.

## Step 4. Connecting the GitHub Repository

Clicking Get started under `Import an existing Git repository` brings up the repo selection screen.

```
                  Deploy a site from your account

    Select a repository to connect as your project's source code.
    New commits will trigger Cloudflare to automatically build and
    deploy your changes.

    [ GitHub ]  [ GitLab ]

    GitHub account
    ┌──────────────────────┐
    │ your-account      ▼  │
    └──────────────────────┘
    + Add account

    Select a repository
    ┌─────────────────────────────────────────────┐
    │ 🔍 Search repositories...                   │
    └─────────────────────────────────────────────┘
    ┌──────────────────┐  ┌──────────────────┐
    │ kidsplay         │  │ chain-play-privacy│
    └──────────────────┘  └──────────────────┘

                                  [Cancel]  [Begin setup]
```

If this is your first time, a GitHub auth prompt appears here — the process of installing the **Cloudflare Workers and Pages** GitHub App. What this app does:

- Auto-builds and deploys whenever a commit lands
- Shows deployment status as a GitHub check run
- Comments a preview URL on every PR (Pages-only feature)

During install, you're asked to choose between **All repositories** and **Only select repositories.** I'd recommend picking just the repos you need. You can always widen the permissions later from GitHub's Settings → Applications.

> **If your repo isn't showing up in the list**, go to the "configure repository access" link on the screen and add that repo to the GitHub App's access. Repos without granted access simply don't appear in the list at all.

Pick your repo and click **Begin setup**.

## Step 5. Build Settings — This Is the Real Core

The values on this screen decide whether the deploy actually works. Here's what I entered.

| Field | Value | Notes |
|---|---|---|
| **Project name** | `kidsnara` | **This becomes the address itself** |
| **Production branch** | `main` | Pushing to this branch triggers a production deploy |
| **Framework preset** | `None` | See below |
| **Build command** | `npm install && npm run build:pages` | Install + build |
| **Build output directory** | `out` | The build result folder |

### The Project Name Is the Domain

Enter `kidsnara`, and you get `kidsnara.pages.dev`. Two things worth knowing here.

**First, the name has to be globally unique.** I originally wanted `kidsplay`, but someone had already claimed it. So I switched to `kidsnara` instead. Assume most common words are already taken, and have two or three backup names in mind.

**Second, you can't rename it later.** More precisely, you'd have to delete the project and create a new one. Better to settle on something you're happy with the first time.

### Set the Framework Preset to None

There's a `Next.js` option in the dropdown. But **don't pick it.**

The `Next.js` preset assumes server-side rendering and typically expects an adapter like `@cloudflare/next-on-pages` alongside it. Since we've already produced static files with `output: "export"`, none of that is needed. If a `Next.js (Static HTML Export)` preset appears, that's fine to use — but **leaving it on `None` and entering the commands directly is the safest bet.** It's much easier to debug your own explicit command than to wonder what a preset is silently changing behind the scenes.

### Where Does the Install Command Go?

Pages build settings **don't have a separate field just for the install command.** By default, Cloudflare looks at the lock file and installs dependencies automatically.

| Lock file | Command run automatically |
|---|---|
| `package-lock.json` | `npm clean-install` |
| `yarn.lock` | `yarn install --frozen-lockfile` |
| `pnpm-lock.yaml` | `pnpm install --frozen-lockfile` |

Most of the time you can just leave it alone. But if you want it explicit, or auto-detection goes wrong, **just chain it into the Build command field with `&&`.**

```bash
npm install && npm run build:pages
```

There's a common claim that `npm ci` is better than `npm install` in CI environments, and that's true. It installs exactly what the lock file specifies and runs faster.

```bash
npm ci && npm run build:pages
```

That said, `npm ci` **fails immediately if `package.json` and `package-lock.json` are even slightly out of sync.** Add a dependency and forget to commit the lock file, and the entire build breaks. For the first deploy, start with `npm install`, confirm it succeeds, then tighten it to `npm ci` afterward if you like.

### Pinning the Node Version

Expand **Environment variables (advanced)** and add this.

```
NODE_VERSION = 22.13.0
```

My project had this in `package.json`:

```json
"engines": { "node": ">=22.13.0" }
```

Cloudflare Pages (the v3 build system) defaults to Node **22.16.0**, so technically it would pass without setting anything. But I'd still recommend pinning it explicitly. **If Cloudflare bumps the default version, the build could break out of nowhere one day.** Pin your own version and that risk disappears.

You can also drop a file at the project root instead of using an env var.

```bash
echo "22.13.0" > .nvmrc
```

Both `.nvmrc` and `.node-version` are recognized. **The environment variable takes priority over the file.** Since `.nvmrc` also helps keep local developers on the same Node version, I personally prefer committing it.

> One caveat: the v3 build system doesn't accept codenames like `lts/hydrogen`. Write it as an explicit number, like `22.13.0`.

Once everything's filled in, click **Save and Deploy**.

## Step 6. Confirming the Deploy

The build log streams in real time. It usually finishes in a minute or two. Once done, a `https://project-name.pages.dev` link appears.

I checked it from the terminal too.

```bash
curl -s -o /dev/null -w "HTTP %{http_code} | %{time_total}s\n" -L https://kidsnara.pages.dev/
# HTTP 200 | 0.057102s
```

57ms. You can really feel the CDN doing its job.

I also checked that all the key files made it up in one pass.

```bash
for p in / /manifest.webmanifest /sw.js /favicon.svg; do
  printf "%-24s " "$p"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" -L "https://kidsnara.pages.dev$p"
done
```

```
/                        HTTP 200
/manifest.webmanifest    HTTP 200
/sw.js                   HTTP 200
/favicon.svg             HTTP 200
```

Comparing the address lengths, too.

```
Before: kidsplay-little-playground.hyunseok-yu1.chatgpt.site  (49 chars, login required)
After:  kidsnara.pages.dev                                     (18 chars, no login needed)
```

## Troubleshooting

### Getting an HTTP 522

Visiting right after deploying can return **522 (Connection Timed Out).** I thought something was broken the first time I saw it, but in most cases it just means **the first deployment hasn't finished yet.**

Check the status on the **Deployments** tab in the dashboard.

| Status | What to do |
|---|---|
| Building / Deploying | Normal. Wait a minute or two |
| Failed | Open the build log and check the error |
| List is empty | The build never triggered. Click Create deployment |

### The Build Succeeded but You're Getting 404s

This is most likely a wrong **Build output directory.** Different frameworks name their output folder differently.

| Framework | Output directory |
|---|---|
| Next.js (`output: "export"`) | `out` |
| Vite / SvelteKit | `dist` |
| Create React App | `build` |
| Astro | `dist` |
| Gatsby | `public` |

Build it locally and check exactly which folder `index.html` ends up in, then enter that name.

### Only a Specific Path Returns 404

In my case it was `/coloring/`. Confusing at first, until I realized that folder wasn't a page at all — it was **an asset folder holding nothing but SVG images.** Static hosting doesn't auto-generate a directory listing for a folder with no `index.html`. Individual files like `/coloring/butterfly.svg` returned 200 just fine.

**A 404 on the directory itself and a 404 on a file inside it are two entirely different problems.** Poke at individual files first.

### A Stray Worker Is Still Lying Around

If you couldn't find the `Get started` link and created a Worker first, a useless project is now sitting in your Workers & Pages list. Delete it from the `...` menu on the right. It might still be holding onto a name you want, so it's worth cleaning up.

## Handy Commands Cheat Sheet

You can do all of this from the CLI instead of the dashboard — useful when you need a quick one-off deploy.

```bash
# Cloudflare login (opens a browser)
npx wrangler login

# Deploy a built folder directly
npx wrangler pages deploy out --project-name=kidsnara

# List deployments
npx wrangler pages deployment list --project-name=kidsnara

# List projects
npx wrangler pages project list
```

That said, **Git integration is far more convenient for everyday use.** Just push, and it deploys itself — and if it fails, you see a red X right on GitHub.

## An Easy Thing to Miss After Deploying

I found one thing after the deploy was already done: the site URL was hardcoded in the code.

```ts
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kidsplay.pages.dev";
```

I'd originally planned on `kidsplay`, but the name was taken so I switched to `kidsnara` — while the default value in the code was left pointing at the old one. That means **the OG image URL points at a domain that doesn't even exist.** Paste the link into KakaoTalk or Slack and no thumbnail shows up.

If you ever rename a project, sweep through these once:

- `metadataBase` and the site URL in OG tags
- `start_url` and `scope` in `manifest.webmanifest`
- Demo links in the README
- Any absolute caching URLs hardcoded in a service worker

## Wrap-Up

The whole flow at a glance.

1. **Get a static build succeeding locally first** — `output: "export"` + `images.unoptimized`, confirm `out/index.html`
2. **Workers & Pages → Create application** — this shows a Worker screen
3. **"Looking to deploy Pages? Get started" at the very bottom** — miss it and you end up with a `workers.dev` address
4. **Import an existing Git repository** — install the GitHub App, pick the repo
5. **Build settings** — project name (= domain), Framework preset set to `None`, chain the install command into Build command with `&&`, output directory exactly right
6. **`NODE_VERSION` env var or `.nvmrc`** — never rely on the default
7. **Save and Deploy** — `name.pages.dev` in a minute or two

The biggest trap was that **Create application leads to a Worker creation screen, not Pages.** Nothing about it was technically difficult — I just burned a good chunk of time hunting for that one link.

If you buy a real domain later, it connects with a few clicks under the project's **Custom domains** tab, and the existing `pages.dev` address keeps working too. My recommendation: ship it free first, then attach a domain once you actually need one.

The result is live at [kidsnara.pages.dev](https://kidsnara.pages.dev). What it is and why I built it is written up separately at [I Built My Own Ad-Free, Payment-Free Playground for My Kids](/en/posts/kidsplay_fullscreen_kiosk_20260723).
