---
title: 'How to run a blog with Claude Code - automate from creation to scheduled distribution'
date: '2026-04-25'
publish_date: '2026-05-16'
description: The complete workflow of running a blog with Claude Code, from post creation, translation, registration, and scheduled distribution.
tags:
  - ClaudeCode
  - blogging
  - Automation
---

Writing a blog consistently is more tedious than you think. The writing itself is one thing, but there's a lot to do afterward.

- Formatting files (frontmatter, tags...)
- Translate the English version
- Copy to the posts folder and commit
- Check for deployment

Doing this manually every time would take more time to manage than to write, so I automated the whole process with Claude Code.

My current flow goes something like this

```
Throw a topic to Claude Code
    → Write a blog-style post
    → Create English translation file
    → Copy to Schedule folder
    → Automatically deploy on a specified date
```

This article explains the entire workflow from scratch.

---]

## Preparation

- Install the Claude Code CLI (with the `claude` command available)
- Next.js based blog (or markdown file based blog)
- GitHub + Vercel linked repo

---

## Step 1 - Create a blog skill

Skills in Claude Code are tools that reduce repetitive tasks to a single command. Once you create a skill file, you can call it with `/skillname`.

Skill file location:

```
~/.claude/skills/SkillName/SKILL.md # Global (all projects)
.claude/skills/skillname/SKILL.md # Local (current project)
```

### blog-write skill

This skill automatically drafts posts. Created in `~/.claude/skills/blog-write/SKILL.md`.

```markdown
---''
name: blog-write
description: "Write a developer blog post with the given topic and save it to the specified path."
user-invocable: true
---

Write a developer blog post in markdown format with the following topic.

## Blog background
- Blog Nature: Developer blog (technical post)
- Author background: Developer getting back into development
- Audience: Developers new to the technology
- Language: Korean

## Writing style
- Down-to-earth, practical tone
- Starts with "why you need this"
- Based on first-hand experience (first person is acceptable)
- Utilize code blocks, tables, and flowcharts

## Save path
/Users/hy/Documents/workspace/claude_code/blog_doc_temp/
File name: topic_YYYYMMDD.en.md

## Create topic
$ARGUMENTS
```

How to call:

```
/blog-write DeepL Automate translation with the API
```

Claude receives a topic, writes a blog-formatted markdown file, and saves it.

---]

## Step 2 - Create the post-register skill

This is the skill that registers the created file to the blog and distributes it. `~/.claude/skills/post-register/SKILL.md`:

```markdown
---]
name: post-register
description: "Registers and deploys the specified file in the blog posts folder. After completion, prefix the original file with ff_."
user-invocable: true
---]

Register the posts in the following order

1. copy the file: Copy the files in the path `$ARGUMENTS` to `content/posts/`.
2. commit & deploy:
   - Verify changes with git status, git diff HEAD
   - Explicitly git add only the copied files
   - Commit with the conventional commit message
   - git pull --rebase origin main followed by git push origin main
3. Rename the original file: Add ff_ prefix to original files after push.
```

How to invoke:

```
/post-register /Users/hy/Documents/workspace/claude_code/blog_doc_temp/deepl_api_20260418.en.md
```

The `ff_` prefix stands for "filed/finished" and is used to distinguish files that have already been registered in the blog_doc_temp folder.

---]

## Step 3 - Set up scheduled publishing (GitHub Actions)

If you want to write a post in advance and automatically deploy it on a specific date, you can utilize GitHub Actions.

### Folder structure

```
content/
├── posts/ ← Currently published posts
└── scheduled/ ← scheduled posts
```

### Workflow files

`.github/workflows/scheduled-post.yml`:

```yaml
name: Publish Scheduled Posts

on:
  Schedule:
    - cron: '0 15 * * * *' # Every day at 00:00 KST
  workflow_dispatch: # Can be run manually

jobs:
  # publish:
    # runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - name: Publish scheduled posts
        shell: bash
        run: |
          TODAY=$(TZ='Asia/Seoul' date '+%Y-%m-%d')

          for file in content/scheduled/*.md; do
            [ -f "$file" ] || continue

            # publish_date first, if not present, use date
            PUBLISH_DATE=$(grep -m1 '^publish_date:' "$file" | sed "s/publish_date: *['\"]//;s/['\"].*//")
            if [ -z "$PUBLISH_DATE" ]; then
              PUBLISH_DATE=$(grep -m1 '^date:' "$file" | sed "s/date: *['\"]//;s/['\"].*//")
            fi

            POST_NUM=$(echo "$PUBLISH_DATE" | tr -d '-')
            TODAY_NUM=$(echo "$TODAY" | tr -d '-')

            if [ "$POST_NUM" -le "$TODAY_NUM" ]; then
              mv "$file" "content/posts/$(basename $file)"
            fi
          done

          git config user.name "hs"
          git config user.email "your@email.com"
          git add content/posts/ content/scheduled/
          git commit -m "post: Publish scheduled post ($TODAY)" || exit 0
          git pull --rebase origin main
          git push
```

### Utilizing the publish_date field

You can leave the `date` (post date) of the file as it is, but specify the publish date separately:

```yaml
---''
title: '...'
date: '2026-04-20' ← the date that will appear in the post
publish_date: '2026-04-25' ← the date it will actually be published
---]
```

If there is no `publish_date`, it will behave as before, based on `date`.

---]

## Actual operational flow

With all of this set up, my day looks like this.

### Publish immediately

```
/blog-write Scraping with Playwright
    → File created
/post-register /blog_doc_temp/playwright_20260425.en.md
    → copy /posts/ → commit → deploy → ff_ appended to original
```

### Publish Schedule

```
Set up the /blog-write JobRadar project
    → File Created
Add publish_date: '2026-04-28' to file frontmatter
Copy to content/scheduled/ folder
git add → git push
    → Deploy automatically at midnight on April 28th
```

---]

## Summary of frequently used patterns

| Tasks | Methods |
|---|---|
| Draft a post | `/blog-write topic name` |
| Immediate registration & deployment | `/post-register filepath` |
| Scheduled Deployment | Add `publish_date` to frontmatter and copy to scheduled/ |
| Delimit post-register files | `ff_` prefix (post-register skill automatically appends) |
| English post registration | Call `/post-register` the same way |

---]

## Troubleshooting

**Skill is not being called

Verify that the path `~/.claude/skills/skillname/SKILL.md` is correct. The file must be named `SKILL.md`.

GitHub Actions push failed** **GitHub Actions push failed

Make sure your Actions workflow has `permissions: contents: write`, otherwise it will fail because you don't have permission to push.

**Scheduled post is not published

Make sure that the `publish_date` format is YYYY-MM-DD with quotes, like `'2026-04-25'`. If the format is different, the date comparison will not work properly.

**Not reflected on the turf

Ensure that `git config user.email` in the Actions workflow matches your GitHub account email. If you set it to `github-actions[bot]` email, it will not be reflected in your account's grass.

---]

## Organize - core flow at a glance

```
1. create blog-write, post-register skills in ~/.claude/skills/
2. create a folder content/scheduled/
3. write .github/workflows/scheduled-post.yml
4. write a post: /blog-write topic
5. deploy immediately: /post-register filepath
   Scheduled deployment: add publish_date → copy scheduled/ → push
```

It takes about an hour to set up initially, but after that, it takes just a few lines of commands to publish a post. The biggest change is being able to focus on writing.
