# Magic Patch shared contract

Generated DTOs and Zod schemas come from the standalone Cloud Magic Patch
`api/openapi.json` version 0.1.0 at service commit 850195e09e999c0d946f1d323ba2b49efef544a8,
with deterministic Zod generator additions in DANNY's next service checkpoint.
The preserved original OpenAPI input SHA256 is
bd3c6fdc38eb93297234a95fc928ed3f8e320f67766711a6bde11fd35924447b.
This local OpenAPI copy and generated outputs are repository-formatted; compare
parsed schema content rather than claiming their formatted bytes have that SHA.

Regenerate in `services/magic-patch` using
`python3 scripts/generate-api-types.py`, copy the three outputs to this package,
and run the frontend's `pnpm exec oxfmt --write packages/magic-patch-types`.
Never edit DTOs or schemas by hand. Use generated Zod parsing for response bodies.
The draft is not a deployed route or a credential/CSRF implementation.
