# Patch database

Generated conversions, one file per converted source file.

```
db/<pack>/<commit7>/<path/to/file.js>.json
```

Organised for humans and git: a reviewer asking "what did we do to rgthree at
d4e5317?" gets a directory they can diff. `compile_db.mjs` inverts the index
into the artifact the client ships, keyed by source hash — the client has only
the bytes and no idea which pack they came from.

Each entry stores **line edits, not converted files**, so the database is not a
redistribution of other people's source under whatever licence it carries.

## Entries are only valid for the exact bytes they were built from

`sourceSha256` is the safety property. A pack that updated silently gets no
patch rather than a mis-applied one.

## Checking them

```bash
tsx scripts/magic-patch/verify_db.mjs db --corpus <corpus>
```

Runs each pack twice — as shipped and as converted — and reports only what got
worse. `EQUIVALENT` means nothing observable changed: it loads, registers the
same types, constructs them, and serialises identically. That is the strongest
claim available; it is not a proof of correctness.

## Current contents

| Pack                   | Files | Verified              |
| ---------------------- | ----- | --------------------- |
| comfyui_essentials     | 1     | EQUIVALENT (4 types)  |
| comfyui-kjnodes        | 1     | EQUIVALENT (38 types) |
| comfyui-custom-scripts | 2     | EQUIVALENT (20 types) |

Every other pack attempted so far punted, and the punt reasons are the input to
what gets built next.
