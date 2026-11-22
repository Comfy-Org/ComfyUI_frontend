# ADR-GRAPH-CLIPBOARD-0059: Storage-independent graph transfer

Date: 2026-11-17

## Status

Accepted

## Context

Graph duplication and template insertion used a browser clipboard cache as an
intermediate transport. A denied storage write could prevent an in-memory
operation, and temporary cache replacement could destroy a user's earlier copy.
Serialization, insertion, browser event routing, and text transport also had
different owners despite sharing clipboard behavior.

## Decision

Separate graph transfer from clipboard transport. Graph serialization and
insertion own identity remapping, lifecycle hooks, layout commands, selection,
and rollback. They accept a target canvas and never access browser storage.
Duplicate, templates, blueprints, and workflow insertion use that interface.

Browser event routing owns editable-target arbitration, synchronous event-data
capture, HTML encoding, media paste, and system-clipboard interaction. Cache
transport reports payload persistence separately from serialized data, so a
refused cache write does not prevent a keyboard copy. Feature callers retain
history, notifications, and template persistence.

Keep extension-facing canvas methods as delegates. Retain the legacy importer
separately because its relative node indices and configure-before-add ordering
are part of the group-node compatibility contract. Graph data contracts remain
in graph-model. Generic text transport belongs below graph and renderer code.

## Alternatives

Moving everything into graph-model would introduce runtime editor dependencies
into a contract package. A platform module would still import renderer-owned
layout operations. Keeping cache snapshot-and-restore wrappers would preserve
the storage dependency and require transactional handling of both payload and
stamp at each caller.

## Consequences

Internal callers use graph transfer without touching the clipboard. Browser
and cache failure handling stay at their transport boundaries. Existing canvas
methods remain available to extensions, while module boundaries prevent callers
from importing browser routing internals.
