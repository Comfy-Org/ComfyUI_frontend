# Go agent-event fixtures

Vendored from `Comfy-Org/cloud` commit `4a43c44176677c2f25f0dcee3f0d2b9870da9891` on 2026-08-30. Sources: `services/agent/api/agent_events.schema.json`, `services/agent/internal/loop/broadcast.go`, and `common/websocket/messages/types.go`.

To regenerate, check out the intended cloud commit; update the SHA and field/type/requiredness projection in `contract.json`; refresh `golden.jsonl` from the Go publisher tests; update `src/event-schema.ts` in the same commit; then run `npm test -- event-schema-drift` and every cmp gate.
