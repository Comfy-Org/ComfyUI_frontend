# ADR-WEBSITE-NAVIGATION-0031: Browser-owned generator navigation

Date: 2026-09-14

## Status

Proposed

## Context

Model generators own paid runs and temporary output URLs in a Vue island.
Cancelling departure must preserve that island, its requests, and its outputs.

Astro's `astro:before-preparation` cancellation means fallback to a full-page
navigation, not cancellation of departure. A `popstate` handler runs after
history has moved; restoring history can race with Astro's pending DOM swap.
Component tests with synthetic events do not reproduce that browser lifecycle.

## Decision

Generator detail routes omit Astro's `ClientRouter`. Astro supports mixing
client-routed pages with ordinary document navigation; entering or leaving a
generator therefore crosses a document boundary.

Internal link clicks wait for the existing application dialog before issuing
navigation. Back, Forward, reload, typed URLs, and tab closure use the native
`beforeunload` confirmation. An accepted application dialog bypasses only the
next unload warning. Run cleanup happens on `pagehide` or component unmount,
never while a departure can still be cancelled.

Rejected alternatives:

- Restoring history after `popstate`: cannot atomically undo an Astro transition.
- Cancelling Astro preparation: explicitly requests fallback navigation.
- Combining Navigation API interception with Astro's History API router:
  introduces two navigation owners and browser-specific cancellation paths.

Browser tests exercise real navigation and verify that Cancel preserves the
document and a downloadable output, as well as showing only one confirmation.

## Consequences

### Positive

- The browser owns atomic cancellation of document departure.
- No history indices, synthetic history entries, restoration races, or timed
  warning exemptions are needed.

### Negative

- Generator transitions require document loads and rehydrate the page.
- Native unload dialogs use browser-provided wording. The page's persistent
  download reminder supplies the output-specific explanation.
- Unload warnings cannot guarantee recovery from process termination; durable
  generation storage would require a separate persistence design.

## Notes

- [Astro router control](https://docs.astro.build/en/guides/view-transitions/#router-control)
- [Browser unload confirmation](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
