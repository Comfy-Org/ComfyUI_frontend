# Cloud node registry

Cloud uses the standard manager's modal layout, navigation, pack-card shell,
search, sort and pack-details pattern. It reads the authenticated workspace's
frozen converted corpus, not the local ComfyUI-Manager installation queue.
Multiple conversion revisions of a pack share one card; the workspace pin is
preferred, and the details panel selects an exact revision without installing
or upgrading anything. Only a confirmed Pin/Unpin response changes selection.

The browser distinguishes:

- Node API version (V1/V2), upstream Git commit and immutable conversion digest.
- Pinned for this workspace versus prepared to run on the current worker.
- Comfy Verified versus not verified. Verification requires the manager's
  operator-reviewed execution receipt for this exact revision. The panel shows
  tested node-type coverage, test time, original workflow/evidence hashes and
  limitations. Converted, prepared or registered alone is not verified.

Missing version metadata disables new pins; missing verification metadata is
unverified. Inconsistent or moved verification receipts are rejected. Failed or
uncertain pin requests preserve the last catalog and require a refresh before
another mutation. An unprepared V2 revision can be pinned but cannot execute
until the trusted warm cycle prepares that exact source/dependency identity.

The current corpus contains V2 conversions only. V1 entries, if supplied in a
future catalog, cannot be pinned for secure execution. Their conversion queue
is explicitly deferred; the UI does not call a nonexistent endpoint or fall
back to local install/private upload/editor APIs.

Future phase: V1 selection queues a source-pinned conversion request. A
server-owned worker uses OpenRouter with the configured Sol 6.1 or Opus 5.5
model and the `secure-nodes-conversion` skill, then submits a V2 patch to the
node-manager service. This phase still needs its queue/admission/idempotency,
patch review and independent runtime-test policy. Provider credentials stay on
the server. Conversion success does not automatically mean Comfy Verified.

This browser does not establish hard per-realm resource limits, GPU/IPC security
or exhaustive frontend parity. The local PC service remains a trusted,
single-user testing deployment.
