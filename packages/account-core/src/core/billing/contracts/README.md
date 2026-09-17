# Generated billing contracts

One file per generated schema the billing SDK core decodes. Each pins the
fields the core actually reads and the enum members it branches on, so a
regenerated `@comfyorg/ingest-types` that renames, drops, or widens one of them
fails a named test here instead of surfacing as a runtime `MALFORMED_RESPONSE`.

A failure means the backend contract moved: fix the SDK, not the test. Where
the SDK reads a field more leniently than the generated schema does, the test
name says so — that row pins the generated shape, not the SDK's.
