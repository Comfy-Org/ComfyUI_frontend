# Datadog view exit flush

`@datadog/browser-rum-core@6.33.0.patch` refreshes the view before each
`PAGE_MAY_EXIT` transport flush. Upstream 6.33.0 refreshes only on
`beforeunload`, so a hidden or frozen page can send an older serialized view
without its latest feature flags and context. The normal view update remains
throttled; this patch refreshes it at the existing exit flush boundary.

The patch covers the source and both distributed module formats. The browser
RUM catalog version is pinned so an upgrade must explicitly address the patch.
Remove it when an unpatched SDK passes:

```sh
pnpm test:unit src/platform/telemetry/datadogViewFlush.test.ts
```

The regression test inspects serialized beacon payloads from the real SDK.
