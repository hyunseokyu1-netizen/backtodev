# Development & Deployment

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Build

```bash
npm run build
npm run lint
npx tsc --noEmit
```

## Deploy

This project is deployed on [Vercel](https://vercel.com). Every push to `main` triggers an automatic deployment.

### Scheduled Posts

Posts placed in `content/scheduled/` are automatically published via GitHub Actions.

- Runs daily at 00:00 KST (UTC 15:00)
- Checks `publish_date` field first, falls back to `date` field
- Moves eligible files to `content/posts/` and pushes a commit

```yaml
# frontmatter example
publish_date: '2026-04-25'  # publish on this date
date: '2026-04-20'          # post date shown on the blog
```

## Tech Stack

- Framework: Next.js (App Router + TypeScript)
- Styling: Tailwind CSS
- Deployment: Vercel
- Scheduled publishing: GitHub Actions
