# ADR-CRDT-INPUTS-0030: Preserve Document Input Order During Agent Materialization

Date: 2026-09-09

## Status

Proposed

## Context

The shared agent document addresses connections by numeric input slot. Registered
Comfy nodes merge saved inputs with the current backend definition during
configuration, which can move dynamically expanded inputs. PM-994 exposed this
with MiniMax H3: the template's width and height indexes became length and
ref_image_size in the live node.

Ordinary graph loading realigns link endpoints by input name. Applying only that
repair to agent materialization would create different slot indexes in the
document and frontend. Later remote connections carry document indexes, while
local connections are minted with frontend indexes.

## Decision

After configuring an agent-created node, restore its saved input order by name.
Keep the configured input objects, including current type and widget metadata;
append inputs absent from the saved array in their configured order. Capture
the saved order before configuration because configuration can mutate its input.

The shared document remains authoritative for existing input positions. This
change does not rewrite the shared document or alter ordinary workflow loading.

## Alternatives considered

- Realign only the local links: fixes the initial image but leaves inbound and
  outbound slot indexes inconsistent.
- Translate slots in both directions: adds another mapping to maintain through
  connection changes and node reconstruction when the document already provides
  the ordering needed by the live graph.
- Change all registered-node configuration: expands the behavior change to
  ordinary loading and extension consumers beyond the agent boundary.

## Consequences

- Existing named inputs keep the same indexes for initial materialization,
  later remote connects, and locally minted connects.
- Definition-only inputs remain available locally. Synchronizing newly created
  dynamic slots or definition-only slots back to the shared document is outside
  this change; it does not add a new semantic operation for slot creation.
- Extension configuration runs before the order is restored, as ordinary
  loading also repairs connections after configuration. This change does not
  establish a new guarantee about topology observed inside configure callbacks.
- Saving and reopening must preserve named connection targets even when ordinary
  loading chooses a different input order.
