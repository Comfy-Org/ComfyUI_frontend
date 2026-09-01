# Marketing Assets

Source images committed here are processed by Astro at build time and emitted
as multiple formats (AVIF, WebP) at multiple widths (640w, 960w, 1280w, 1920w).

## Usage

Drop a high-resolution source image (PNG or JPG) here, then render it with
Astro's built-in `<Picture>` component plus the shared defaults:

```astro
---
import { Picture } from 'astro:assets'
import {
  MARKETING_FORMATS,
  MARKETING_WIDTHS
} from '../utils/marketingImage'
import hero from '../assets/marketing/hero.png'
---
<Picture
  src={hero}
  alt="ComfyUI workflow preview"
  formats={[...MARKETING_FORMATS]}
  widths={[...MARKETING_WIDTHS]}
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

The component generates a `<picture>` element with `<source>` tags for AVIF
and WebP, plus an `<img>` fallback. Output files are hashed and emitted under
`dist/_website/` for long-term caching.

A custom Astro wrapper component is intentionally not provided: Astro's
discriminated union `LocalImageProps | RemoteImageProps` for `<Picture>` makes
a thin wrapper that mutates `widths` / `formats` impractical to type safely
without `as` casts. The shared constants give us the same consistency benefit
without that cost.

## When to use this vs. `media.comfy.org`

- **Use `src/assets/marketing/`** for static marketing images that are part of
  page content (hero shots, product imagery, illustrations). Build-time
  processing gives you AVIF/WebP variants automatically.
- **Use `media.comfy.org`** for video content, large/changing image libraries
  (gallery), and anything shared across properties.

## Source image guidelines

- Provide the largest size you'll ever need (≥1920px wide).
- PNG for screenshots/illustrations with sharp edges; JPG for photographs.
- Astro will downscale; it will not upscale. Always supply at least 1920w.
