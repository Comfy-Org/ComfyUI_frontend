/**
 * DynamicPrompts — v2 extension API.
 *
 * STUBBED PENDING NEW PUBLIC API per D-no-node-widget-access (2026-05-19).
 *
 * The previous v2 implementation iterated `node.getWidgets()` inside
 * `defineNode.nodeCreated` to attach `beforeSerialize` handlers to every
 * widget with `options.dynamicPrompts === true`. That pattern is now
 * forbidden by the bilateral A1 closure: nodes cannot enumerate or
 * reference their widgets.
 *
 * The clean v2 path for "augment all widgets matching predicate P with
 * behavior B" does not yet exist on the public surface. `defineWidget`
 * registers a NEW widget type with a `mount` lifecycle; it does not
 * augment existing types' instances.
 *
 * Restoration plan (follow-up issue to file):
 *   - Add a `defineWidgetAugmenter({ matches, setup })` (or per-widget
 *     `setup(widget)` hook on `defineWidget`) so extensions can attach
 *     behavior to existing-typed widgets opted in via `options`.
 *   - Migrate this stub to that API once it ships.
 *   - Update D-no-node-widget-access "Restoration criteria" if the
 *     augmenter API requires loosening A1 (it shouldn't — the augmenter
 *     hands the extension a `WidgetHandle` directly, never via a node).
 *
 * v1 (`Comfy.DynamicPrompts`) continues to work — this is a v2 surface
 * gap only, not a user-visible regression.
 */

// Intentionally empty — no `defineNode` / `defineWidget` registration.
// See block comment above for context.
export {}
