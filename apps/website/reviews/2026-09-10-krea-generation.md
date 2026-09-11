# Krea generation failure reproduction

Tested September 10, 2026, 22:31–22:33 PDT (September 11, 05:31–05:33 UTC).

Preview: https://comfy-website-preview-pr-17382.vercel.app
Application head: `6b2f6054aa3f6e42319053859eecb373a8830c6a`.
Vercel preview run `34565698310` succeeded for that head.
Backend: `https://testapi.comfy.org`.
Selected schema revision: `9064b7d8748b2e5833be9a102f3ca36185137d86`.

## Results

Real signed-in browser session, not mocked auth. Entered through the Models menu
and used related-model links for the next two variants. One generation attempt
per variant in the initial pass; the later requested retry is recorded below.
No uploads, payments, or production-backend calls.

| Model               | HTTP / error         | Duration | Request ID                             |
| ------------------- | -------------------- | -------: | -------------------------------------- |
| Krea 2 Medium Turbo | 502 / provider_error |  1.393 s | `d6f8b90e-f916-499b-b2d3-6df082e0a7f2` |
| Krea 2 Medium       | 502 / provider_error |  0.729 s | `bd325a3c-5bf9-4d86-a3d1-7770028b51d6` |
| Krea 2 Large        | 502 / provider_error |  0.787 s | `ccc50e76-3dbe-4991-9f65-11638ae7043f` |

All three POSTs reached `/v2/models/krea/<model>` and returned readable JSON:

```json
{
  "detail": "The upstream model provider returned an error.",
  "error_type": "provider_error"
}
```

The UI displayed its provider-failure message and matching request ID. No output
was produced or decoded. Observed cost is unknown; failure is not proof of no
charge.

## Inputs

All three used the same synthetic prompt:

> A red ceramic mug on a wooden desk, soft window light, studio product photograph.

Medium Turbo sent `aspect_ratio: "3:2"`, `creativity: "low"`, `resolution: "1K"`.
Medium and Large sent `aspect_ratio: "1:1"`, `creativity: "medium"`,
`resolution: "1K"`. These were the page's initial example/default settings;
only the prompt was replaced. No `seed` field, `-1`, media, or extra parameters
were sent. Each request had a nonempty idempotency key.

Revalidated the exact captured JSON bodies using the application's real
`validatorFor()` and selected `workshop-router-contracts.json` input schemas:
all three valid, no validation errors.

Sanitized bodies, timestamps, request IDs, SHA-256 body/key hashes, and outcomes
are in [the packed attempt records](../testing/krea-generation-2026-09-10.jsonl).
No account identifiers or credentials were captured in those records.

## Diagnosis boundary and next check

This reproduces a Router/provider-side failure, not the earlier disabled Run
button, a browser CORS failure, or a local form-validation rejection. The browser
received the backend response and exposed request ID. Router did not classify
these requests as unauthorized, insufficient credits, or invalid input.

The public response does not reveal Krea's underlying status or error. Provider
credentials/configuration, routing, provider availability, and provider-side
rejection cannot be distinguished from this response alone. No backend fix is
claimed. There is no connected log-search tool or configured Kubernetes context
in this session, and an unauthenticated live schema GET returns 401.

The Router team should correlate the three request IDs in TEST `comfy-api` logs
at the timestamps above and inspect `upstream_status`, poll/submission stage,
and the Krea trace. No separate Router issue or Slack message has been posted.

The scrollbar experiment remains reverted. No application code was changed
during this reproduction.

## Explicit retry at 22:35 PDT

Ben requested another try. Clicked **Try again** on the existing Krea 2 Large
failure without editing or reloading the page. The body and idempotency-key
hashes exactly match the previous Large attempt.

- Request: `2026-09-11T05:35:50.796Z` to `05:35:51.967Z`, 1.170 seconds.
- Result: HTTP 502, `provider_error`, same public error text, no output.
- Request ID: `28df864c-2284-4f09-8334-91603a130069`.

No other variants were retried. This proves the browser retry still fails;
the public response alone cannot establish whether the provider was contacted
again or the result was replayed under the unchanged idempotency key.
