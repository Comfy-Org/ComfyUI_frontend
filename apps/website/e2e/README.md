# Website browser tests

Use `test` from `./fixtures/blockExternalMedia`, not `@playwright/test`.
Use its `page` and `context`. Set user-agent variants with scoped `test.use`
options instead of creating browser contexts.

## No external requests

Register test-specific `context.route` responses before navigation. They override
the shared routes, including a popup's first request. Use `route.fulfill` or
`route.abort`, never `route.fetch` or external `route.continue`. Do not use Node
network clients. Assert destination URLs without contacting them.

## Verify without outbound connectivity

Install dependencies and build the website before restricting the network:

```sh
NODE_ENV=production WORKSHOP_IN_BUILD=1 PUBLIC_WORKSHOP_ROUTER_RUN=1 PUBLIC_WORKSHOP_CLOUD_ENV=test \
  WEBSITE_GITHUB_STARS_OVERRIDE=110000 PUBLIC_CUSTOMERIO_WRITE_KEY=test-e2e-write-key \
  pnpm --filter @comfyorg/website build
```

Models auth/session responses are mocked by its fixture; no Router generation
or payment is submitted. The auth flag is enabled by that fixture's PostHog
response, not globally for unrelated website tests.
Use production mode even locally: inheriting `NODE_ENV=development` removes
PostHog initialization from the built page, so the mocked flag cannot settle.

If port 4321 belongs to another worktree, use an unused port for this build:

```sh
WEBSITE_E2E_PORT=4326 PLAYWRIGHT_HTML_OPEN=never \
  pnpm --filter @comfyorg/website test:e2e --project=desktop e2e/workshop.spec.ts
```

On Linux with `sudo`, `unshare`, and `ip`, run from the repository root:

```sh
sudo unshare --net sh -c '
  ip link set lo up
  ip link add dummy0 type dummy
  ip addr add 192.0.2.1/24 dev dummy0
  ip link set dummy0 up
  exec runuser -u "$1" -- env PATH="$2" CI=true PLAYWRIGHT_HTML_OPEN=never \
    "$3" --filter @comfyorg/website exec playwright test --workers=2 --retries=0
' sh "$(id -un)" "$PATH" "$(command -v pnpm)"
```

The dummy interface keeps `navigator.onLine` true so the email SDK submits
instead of queueing offline. Astro preview and Playwright both run inside the
namespace.

## Font fixture

`assets/inter-latin.woff2` is the unmodified Inter Latin font from the website's
[Google Fonts stylesheet](https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap),
downloaded for Chromium on September 7, 2026. Its
[source file](https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2)
has SHA-256 `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62`.
The SIL Open Font License is in `assets/Inter-OFL.txt`.
