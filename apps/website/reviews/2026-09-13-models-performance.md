# Models performance follow-up

Christian's report prompted an audit of data loading, video previews, and background animation on the live Models routes. The related SDK examples and sign-in recovery are separate changes.

## Findings and changes

- The catalogue imported the same module that joins and validates the source catalogues at build time. Importing its filter helpers caused that work and its source data to ship to the browser, even though Astro already supplies the prepared cards. Data ownership now stays in `workshop-browse-content`; filtering helpers have no catalogue-data dependency. Model pages and aliases still resolve from the same approved manifest.
- Model-card videos loaded metadata and started playback throughout the page, including horizontal overflow and rows below the viewport. Preview videos now attach their source only while visible in a visible tab, pause and release the source when hidden, and respect reduced motion. Unmount releases the media resource. The same lifecycle covers the featured video.
- The featured carousel's animation loop continued while offscreen. Rotation now stops offscreen and in hidden tabs, retaining hover, keyboard-focus and reduced-motion behavior.

## Controlled browser measurements

Baseline: `fab94df2fb` with the same production build configuration as the TEST preview. Chrome 149.0.7827.55, macOS 25.5.0, Apple M5 Pro, 48 GiB RAM, 1440×900 at 1×. Each sample used a fresh browser context, fixed local media fixtures, blocked external APIs, and an uncompressed local static server. No paid generations ran.

Two warmups per arm, then ABBA/BAAB (four recorded samples per arm). Build processes were stopped before sampling. Times and heap below are medians at hydration; bytes are decoded JavaScript actually requested through the catalogue search or detail API-tab interaction.

| Catalogue measurement |       Before |        After | Change |
| --------------------- | -----------: | -----------: | -----: |
| Requested JavaScript  |  2,450,151 B |  1,395,168 B |   −43% |
| Script duration       |      36.4 ms |      20.9 ms |   −43% |
| Used JS heap          | 19,088,326 B | 12,851,676 B |   −33% |
| Hydration reached     |     176.5 ms |     154.2 ms |   −13% |

The Seedream 4.5 detail page was effectively unchanged: 1.67 MB JavaScript and approximately 111 ms to hydration. Its emitted 3.8 MB complete-contract chunk was **not requested**; emitted bundle size alone was not treated as a page-load regression. No long tasks occurred on this fast machine. These results do not measure provider latency, real media decoding costs, mobile performance, or Core Web Vitals in production. The final featured-carousel lifecycle change followed the table's measurement run; it is covered by behavior tests.

## Regression checks

`e2e/models-performance.spec.ts` exercises working catalogue search with a 1.8 MB decoded-JavaScript budget and actual browser video readiness/playback before and after scrolling, including reduced motion. Both tests fail against the baseline (2.66 MB with the full account fixture, and offscreen videos already loaded), and pass with the fixes. `FeaturedBanner.test.ts` checks that rotation freezes offscreen and in a hidden tab, then resumes.

Run against a TEST-enabled build:

```sh
NODE_ENV=production WORKSHOP_IN_BUILD=1 PUBLIC_WORKSHOP_ROUTER_RUN=1 PUBLIC_WORKSHOP_CLOUD_ENV=test WEBSITE_GITHUB_STARS_OVERRIDE=110000 PUBLIC_CUSTOMERIO_WRITE_KEY=test-e2e-write-key pnpm --filter @comfyorg/website build
pnpm --filter @comfyorg/website exec playwright test e2e/models-performance.spec.ts --project desktop --workers 1
```

These are website checks. The canvas-specific performance CI does not establish a website timing baseline. The byte budget is deterministic; timings are supporting local evidence, not a CI performance guarantee.

## Reviewer criteria and remaining boundaries

[Alex's review of the account integration](https://github.com/Comfy-Org/ComfyUI_frontend/pull/17283#pullrequestreview-5172958399) emphasizes single ownership and explicit lifecycle boundaries. [Christian's follow-up](https://github.com/Comfy-Org/ComfyUI_frontend/pull/17283#issuecomment-5627167630) accepts a narrow unblock when architectural follow-ups have explicit owners. This change keeps catalogue data with its existing owner and uses one shared preview lifecycle rather than independent playback rules.

The existing all-locale translation payload (~546 KB) and shared analytics remain material page costs. They span the website and need their own measured optimization and localization/consent validation. No production RUM percentiles were available for this work; the numbers above are local measurements only.

The featured slide keeps its source in the server-rendered markup, so the browser requests its first frame during parse rather than after hydration and the first observer callback. Cards request theirs 20% of a viewport before they scroll in. A hidden tab and reduced motion only pause; scrolling away is what releases a card's buffer, and a banner slide releases its outgoing video when the next one takes over.
