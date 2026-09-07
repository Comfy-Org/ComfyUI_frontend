# Website browser tests

Use `test` from `./fixtures/blockExternalMedia`, not `@playwright/test`.
Use the fixture's `page` and `context`; use scoped `test.use` options for
user-agent variants rather than creating another browser context.

## No external requests

The context routes allow only the configured preview origin to reach the
network. Known analytics requests are aborted; media, fonts, and embeds receive
local responses. Unexpected URLs are blocked and fail the owning test.
Service workers are disabled. WebSockets are blocked and reported too.

A local deny proxy rejects traffic that bypasses routing, including preconnects.
It never forwards requests. Playwright's request fixture also uses that proxy.
Do not use Node network clients in these tests.

Register test-specific `context.route` responses before navigation. They override
the shared routes, including for a popup's first request. Use `route.fulfill` or
`route.abort`, never `route.fetch` or external `route.continue`. Assert the real
destination URL and application behavior without contacting that destination.

`network-isolation.spec.ts` runs isolated failing probes to verify that unknown
navigations, popup requests, and WebSockets fail their tests. It also verifies
that an HTTP route bypass receives the deny proxy's 502 response.

## Verify without outbound connectivity

Install dependencies and build the website before restricting the network:

```sh
WEBSITE_GITHUB_STARS_OVERRIDE=110000 PUBLIC_CUSTOMERIO_WRITE_KEY=test-e2e-write-key \
  pnpm --filter @comfyorg/website build
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

The namespace has no external interface or default route. The dummy interface
keeps `navigator.onLine` true so the email SDK exercises submission rather than
offline queuing. Both Astro preview and Playwright run inside the namespace.

## Font fixture

`assets/inter-latin.woff2` is the unmodified Inter Latin font served by the
website's [Google Fonts stylesheet](https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap),
downloaded for Chromium on September 7, 2026. The fixture embeds it in the CSS
response so tests never download fonts. Its [source file](https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2)
has SHA-256 `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62`.
The SIL Open Font License is in `assets/Inter-OFL.txt`.
