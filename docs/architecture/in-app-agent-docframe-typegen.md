# In-App Agent doc-frame type-generation contract

The CRDT doc-frame wire contract is owned by Comfy Cloud's ingest service. The frontend consumes it
as a generated artifact and does not maintain a second protocol definition.

## Contract

```text
cloud services/ingest/openapi.yaml          (authority)
        ├──▶ cloud common/websocket/docframes  (generated Go models)
        └──▶ packages/ingest-types             (generated TS types + Zod schemas)
                 └──▶ src/workbench/extensions/agent/crdt
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

## Validation the generated schema cannot provide

`update_b64` is declared `type: string` with a base64 `contentEncoding` annotation. Both OpenAPI
and the Zod schema generated from it treat that annotation as documentation, so neither rejects a
malformed payload. Cloud validates base64 in code (`validateB64` in `common/websocket/messages`),
and the frontend does the same in `parseServerDocFrame`. Schema conformance is therefore necessary
but not sufficient, and `docFrameWireContract.test.ts` pins both halves.

## References

- Cloud PR [#7730](https://github.com/Comfy-Org/cloud/pull/7730) — generated CRDT doc-frame wire types.
- `docs/guidance/typescript.md` — server/API response types come from the generated shared packages.
- `docs/adr/CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md` —
  frontend follower boundary.

## Glossary

- **Doc frame:** a CRDT message carried by the WebSocket `{type,data}` envelope.
- **Wire spelling:** the serialized field name shared by all producers and consumers.
- **Adapter boundary:** the one place a consumer may map a wire name to an internal name.
