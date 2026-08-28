# In-App Agent doc-frame type-generation contract

This document cross-references the type-generation work in frontend PR #16191. The wire contract
is governed by workspace ADR-017 and cloud PR #7730; this frontend branch owns the generated
consumer surface and its freshness guard, not a second protocol definition.

## Contract

```text
cloud services/ingest/openapi.yaml
        ├──▶ generated cloud doc-frame models
        ├──▶ FE projection / generated ingest types
        └──▶ generated smoke client
             all outputs must pass freshness checks
```

- `doc_update`, `doc_reset`, and `doc_ops_result` are derived from the cloud OpenAPI source.
- `doc_ops_result.data.failed` is the wire spelling. A frontend adapter may expose `failure`, but
  that mapping must remain at the adapter boundary.
- Generated types describe the `{type,data}` bytes; they do not implement CRDT application,
  authority, or mutation semantics.
- Any schema change regenerates every committed output and must leave the dual-directory freshness
  gate green before the contract is considered landed.

## References

- Workspace ADR-017: [OpenAPI doc-frame authority](https://github.com/christian-byrne/in-app-agent-program/blob/main/decisions/ADR-017-docframe-openapi-authority-and-typegen.md).
- Cloud PR [#7730](https://github.com/Comfy-Org/cloud/pull/7730).
- Workspace verification: `reports/audit/verify-dir-12-openapi-landing-current.md`.
- Related frontend follower boundary: `docs/adr/0019-in-app-agent-crdt-follower-and-distribution.md`.

## Glossary

- **Doc frame:** a CRDT message carried by the WebSocket `{type,data}` envelope.
- **Wire spelling:** the serialized field name shared by all producers and consumers.
- **Freshness gate:** CI that regenerates outputs and rejects stale committed files.
- **Adapter boundary:** the one place a consumer may map a wire name to an internal name.
