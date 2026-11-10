# ADR-LAYEREDITOR-0055: Optional Vue session ownership

Date: 2026-11-10

## Status

Accepted

## Context

The batch-image editor and ImageCompositor use the same editing session.
Keeping that session in the application splits reusable editing behavior
between the host and the layer-editor package. The session exposes Vue refs,
but the rendering engine does not require Vue.

## Decision

The layer-editor package owns the session behind a dedicated `vue` entry
point. Vue is an optional peer dependency. Engine modules must not import
the Vue session, so engine-only consumers do not load Vue.

The package also owns PSD encoding and the ImageCompositor recipe format.
Recipe serialization is distinct from general editor-document serialization.
Graph widget contracts consume recipe types from the editor package, never
the reverse.

The application owns graph identity, node execution callbacks, backend image
URLs, workflow persistence, preview URL lifetimes, dialogs, and downloads.
These integrations remain in the application. The sibling layer-editor-ui
package owns reusable Vue controls and consumes the optional Vue session.
Controls request host-owned effects through events rather than importing
application services. The host supplies translations and theme styles.

The UI package is private and source-consumed, like the design-system Vue
components it uses. It does not introduce a published bundle or another Vue
runtime.

## Alternatives

- Keeping the session in the host preserves a framework-free package but
  leaves dedicated editor behavior split across owners.
- Rewriting the session as a framework-free controller would add an interface
  and reactive synchronization solely to move existing behavior.
- Moving graph integration into the package would couple the editor to the
  host and introduce a reverse dependency on graph contracts.
- Keeping reusable controls in the engine package would couple its release
  and dependency contract to the application's design system.

## Consequences

Vue consumers retain the existing reactive session contract. Other consumers
can use the engine without Vue. PSD encoding remains lazy-loaded, and the
recipe wire format remains unchanged.
