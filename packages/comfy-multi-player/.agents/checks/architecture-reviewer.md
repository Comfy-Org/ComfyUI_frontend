# Architecture review

Apply this profile to structural and design changes across `src/**`, the public entrypoint, and the layer split between applier, projection, mint, stamps, doc, migrate, and types. It protects the portability and single-implementation invariants (KA-3, FC-3) at the design level.

- Flag over-engineering: abstractions for a single call site, premature generalization, indirection that does not earn its keep. This package is a small pure library; proportionality matters.
- Flag mixed responsibilities: keep op validation, mutation, projection, and stamp/ordering concerns separated. A function that both validates and mutates is the shape behind the "rejected op mutates the doc" class of bug (issue #10) — prefer validate-before-mutate.
- Keep the dependency direction one-way and pure: `applier`/`project`/`mint` must not import DOM, framework, LiteGraph, server-only, or filesystem code (FC-3). Lower pure layers must never depend on transport, host, or wire concerns.
- Guard the single-implementation rule: any design that implies a second op-to-document implementation (for example a parallel path in Go, or a divergent browser vs host code path) is a blocking FC-3 concern. The browser and the Node doc host consume this one package.
- Watch change amplification: a design where adding one op kind or one widget-storage strategy forces edits in many files signals a missing exhaustiveness seam (see issue #21). Prefer a single switch the compiler can prove exhaustive.
- Do not report bugs, security, or performance here (other profiles cover those). Rate severity by impact on future maintainability and on the KEEP-ALIVE invariants in `docs/INVARIANTS.md`.

> Before reporting PASS for any check above, apply [vacuity.md](vacuity.md): P0 to every check, P1 to any guard this change adds, P10 to what that guard's test asserts on, P2 to any tool you ran, and P7 to any run you quote.
