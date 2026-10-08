# Cross-repository release handoff

Changes to `@comfyorg/comfy-multi-player` flow to cloud before frontend exposure:

```text
cmp merge + immutable release
  -> cloud pin + tests + dark deploy + runtime proof
  -> frontend pin + tests + flag-off deploy
  -> flags on + authenticated browser canvas/reconnect proof
  -> stable promotion of the exact tested combination
```

The package release is the producer gate. Run the repository's full package gates, publish an
immutable npm version when consumers use npm, and prove a clean install resolves it. Never hand off
a moving branch or an unpublished version. An explicitly approved Git dependency must use a full
commit SHA.

The producer release is cut by merging a version-bump PR that carries the `Release` label:
merging it tags `comfy-multi-player-v<version>` and runs
`.github/workflows/publish-comfy-multi-player.yaml` in `Comfy-Org/ComfyUI_frontend`
automatically. Merging anything without that label releases nothing. See "Cutting a release" in `CONTRIBUTING.md` for the
mechanics and the manual fallback. The automation replaces the hand-run tag push only; the
gates, provenance, and the rest of this handoff are unchanged, and the coordinator still owns
confirming the published version before any consumer pins it.

The package source lives in the frontend repository, but the frontend app is still a consumer:
it pins an exact published version (currently `0.3.6`) and moves to a new one only through its
own pin change, after cloud has accepted that version. Sharing a repository does not shorten this
order.

Both consumers must resolve the same accepted package version. Cloud compatibility comes first so
the frontend never emits or requires a contract the deployed doc-host cannot handle. Deployment is
not proven by a green build: the handoff needs the running cloud revision, resolved package version,
doc-host health, readable schema, catalog pin, and request/frame behavior.

After the frontend consumer deploys with exposure off, QA records exact frontend/cloud revisions,
package version, and flag values. Acceptance requires an authenticated browser flow that causes a
visible canvas edit and survives reconnect. Expand the `agent-in-app-experience` cohort only after
that receipt. `AGENT_CRDT_MODE` plus `workflows.crdt_enabled` selects the storage path; it is not the
product flag.

Documentation-only changes may proceed in parallel. Runtime PR sets must link their producer and
consumer PRs and identify the release coordinator, cloud deploy verifier, frontend deploy verifier,
and QA receipt owner.

## Glossary

- **Dark deploy:** compatible code deployed while user exposure is disabled.
- **Integrated receipt:** exact revisions, package version, flags, and browser-visible proof.
- **Producer gate:** the merged and installable package release consumers are allowed to pin.
