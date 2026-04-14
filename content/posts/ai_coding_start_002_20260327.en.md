---
title: '[AI Start Development_002] Add Image'
date: '2026-03-27'
description: Add image embedding feature
tags:
  - Add blog image.ai
---
## Image insertion

I inserted an image, and when I wrote, I thought that I couldn't see it, because it was an absolute path, so of course I couldn't see it, and that I would try to distribute it and see it again.

![screenshot 2026-03-27 11.09.49 AM](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-03-27_______11_09_49_1774580287472.png)


### Again, the image is not visible.

![screenshot 2026-03-27 11.51.20 AM](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-03-27_______11_51_20_1774580303414.png)



> "If you look at the image here, you can't see the uploaded image. If you look at the collar, the image is uploaded       
I think there is. Can you check the route shown? "    

When asked, explain as below:

![screenshot 2026-03-27 11.53.29 AM](https://raw.githubusercontent.com/hyunseokyu1-netizen/backtodev/main/public/images/___________2026-03-27_______11_53_29_1774580510070.png)


```typescript
⏺ Let's check the image path on GitHub.
⏺ The images went well on GitHub public/images/, but the problem was that Vercel since we only serve public/folders, images uploaded later will not be able to find the path.

  Searched for 1 pattern, read 1 file (ctrl + o to expand)

⏺ I checked the cause. It currently returns a URL to/images/filename.png, which is Vercel's the public/folder is fixed at build time and cannot serve newly uploaded images.
   Edit to link directly to the GitHub raw URL.

⏺ The previously uploaded images now need to be modified from markdown to raw URLs as well. Currently
  Determine the image path in use in the post.

⏺ The path has been rerouted correctly, it will be reflected on GitHub.

⏺ You've deployed! Your image should now look good.

  Cause Summary: Because Vercel only serves public/folders at the time of build,

The added image could not be accessed via/images/... path. GitHub raw
  Fixed direct link to URL: raw.githubusercontent.com/...

✻ Cooked for 1m 56s

```


This is how you will be informed.

> Are you really reading my mind???


In the old days, you had to find the cause, solve it, distribute it, even write a summary of the cause and a report of the result. In a way, it may have been the amount of hours you had to work alone, but I can only admire you for doing this in a few minutes...
