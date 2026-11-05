# In-App Agent doc-frame type-generation contract

The CRDT doc-frame wire contract is owned by Comfy Cloud's ingest service. The frontend imports its
generated types and schemas. Its production WebSocket boundary remains a handwritten adapter that
independently validates raw JSON before exposing frontend domain objects; a compatibility test feeds
generated schema output through that adapter to detect disagreement between the two representations.

## Contract

```text
cloud services/ingest/openapi.yaml          (authority)
        ├──▶ cloud common/websocket/docframes  (generated Go models)
        └──▶ packages/ingest-types             (generated TS types + Zod schemas)
                 └──▶ docFrameClient.ts       (validation + domain adapter)
```

- `ServerDocFrame`, `DocUpdateFrame`/`DocUpdateData`, `DocResetFrame`/`DocResetData`,
  `DocOpsResultFrame`/`DocOpsResultData`, and `DocOpFailure` come from `@comfyorg/ingest-types`.
  `@comfyorg/ingest-types/zod` exposes the matching runtime validators.
- `packages/ingest-types` is regenerated from the cloud spec by an automated sync
  (`[chore] Update Ingest API types from cloud@<sha>`). That sync is the freshness mechanism; the
  frontend does not re-derive the schema locally.
- `doc_ops_result.data.failed` is the wire spelling. A frontend adapter may expose `failure`, but
  that mapping must remain at the adapter boundary.
- Generated types describe the `{type,data}` bytes; they do not implement CRDT application,
  authority, or mutation semantics.
- `parseServerDocFrame` does not invoke Zod in production. It independently validates raw WebSocket
  values, converts the generated schemas' `bigint` int64 output to safe numeric domain values, and
  maps snake-case wire fields to frontend names. Its compatibility tests pass representative
  generated outputs through that adapter and assert their complete mapped payloads; they do not
  claim that the handwritten parser accepts every value admitted by the generated schema.

## Validation the generated schema cannot provide

`update_b64` is an unconstrained string in the authoritative OpenAPI contract, so its generated Zod
schema also accepts malformed payloads. Cloud validates base64 in code (`validateB64` in
`common/websocket/messages`), and the frontend independently validates it in
`parseServerDocFrame`. The adapter can therefore reject schema-conforming input. Conversely, the
adapter accepts some raw frames that the generated schema rejects, such as a `doc_update` without
`lineage_seq`, because the frontend domain object does not use that field. The compatibility test
pins representative generated outputs plus these intentional boundary differences rather than
treating schema conformance as a prerequisite for adapter acceptance.

## References

- Cloud PR [#7730](https://github.com/Comfy-Org/cloud/pull/7730) — generated CRDT doc-frame wire types.
- `docs/guidance/typescript.md` — server/API response types come from the generated shared packages.
- `docs/adr/CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md` —
  frontend follower boundary.

## Glossary

- **Doc frame:** a CRDT message carried by the WebSocket `{type,data}` envelope.
- **Wire spelling:** the serialized field name shared by all producers and consumers.
- **Adapter boundary:** the one place a consumer may map a wire name to an internal name.
