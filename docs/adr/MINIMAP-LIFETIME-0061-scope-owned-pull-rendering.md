# ADR-MINIMAP-LIFETIME-0061: Scope-owned minimap rendering

Date: 2026-11-22

## Status

Proposed

## Context

Legacy extensions can mutate graph geometry without emitting an event. A minimap
therefore cannot depend entirely on graph notifications. Camera motion and
animated decorations also need different update cadences from graph inspection.

Graph IDs can change during configuration. When a graph reference changes, scope
disposal can run before its queued watcher. Cleanup must identify the resource
that was installed, not infer it from the latest reference or ID.

See [FRONT-4337](https://linear.app/comfyorg/issue/FRONT-4337) and the complementary
fixes in [#24110](https://github.com/Comfy-Org/ComfyUI_frontend/pull/24110) and
[#24112](https://github.com/Comfy-Org/ComfyUI_frontend/pull/24112).

## Decision

The mounted minimap owns its controller. Controls that borrow its appearance do
not construct a rendering engine. Vue scope disposal owns subscriptions and
scheduled work; callers do not manage a separate lifecycle protocol.

A graph watcher captures the configured listener and the graph it was attached
to in its cleanup. Graph changes, null transitions, and scope disposal release
that exact attachment, including disposal before a queued replacement runs.
Graph callbacks remain untouched.

A bounded poll detects legacy direct mutations. Changes distinguish geometry
from picture-only updates, so color, execution state, and decoration animation
do not rebuild bounds. Bounds and painting share one projection per refresh.
Decoration frames reuse the published node projection until the next refresh,
so geometry and bounds remain consistent. Each paint cycle uses one timestamp
for drawing and deciding whether animation continues.
Camera tracking keeps its separate frame loop. Scheduled work pauses when the
host or bitmap canvas is absent, or the document is hidden.

## Alternatives and consequences

Retaining a hook registry and an installed-target pointer preserves cleanup but
leaves resource ownership split across callers and watchers. Watcher cleanup
provides the same guarantees without lookup or callback restoration.

Replacing polling with more graph hooks misses direct mutations and depends on
extension callback chaining. Ordinary mutations may instead appear on the next
poll. Configuration completion invalidates the comparison baseline even when
serialized geometry is unchanged.

Building a full node projection on every idle comparison would align detection
and painting but adds allocation during quiet ticks. Compare exact serialized
scalar tuples instead, and construct the shared renderer projection only when
painting. Rolling hashes missed valid color changes and cancelling coordinate
changes. Exact comparisons retain more data per poll but avoid accumulating
property-specific collision fallbacks. The geometry version is compared
independently, and geometry remains quantized to eighth-pixel increments.

Execution-state lookups parse existing progress locators into a scoped map.
They do not encode graph node IDs: workflow IDs can contain unpaired UTF-16
surrogates that URI encoding rejects. Nodes without a matching progress entry
still participate in comparison and painting, without an execution outline.
