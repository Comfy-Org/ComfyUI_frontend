# ADR-MASKEDITOR-EXTENSIONS-0001: Session-scoped external MaskEditor tools

Date: 2026-10-31

## Status

Proposed

## Context

Image segmentation extensions need to collect prompts in the native editor,
run their own inference, and apply the resulting mask without replacing
frontend methods or importing internal stores. The existing command API can
open MaskEditor but cannot participate in its input or history lifecycle.

Asynchronous inference can outlive the image that prompted it. A history index
cannot identify that image state: Undo/Redo reuse indices, and a bounded history
keeps the same index when it evicts its oldest entry.

## Decision

Expose a tool registry through `extensionManager.maskEditor`. Each activation
creates a disposable session with copied base-image pixels, normalized pointer
events, a panel mount container, point overlays, and a mask-only commit method.
The frontend owns input routing, rendering, history, and node persistence.
Inference and tool-specific controls remain extension code.

Use a monotonic document revision to reject stale commits, and AbortSignals
to notify extensions when work is obsolete. Disposal prevents old contexts
from mutating reopened editors even when an extension ignores cancellation.
The session's own commit is one native Undo step; prompt-point history remains
the extension's responsibility. Marker overlays are transient and never enter
saved pixels or document history.

Panel mounting uses a framework-neutral container and cleanup function. This
follows the bundled-dependency boundary in
[ADR-EXTENSIONS-PUBLIC-API-0005](EXTENSIONS-PUBLIC-API-0005-bundle-vue-dependencies-in-extensions.md).

## Alternatives considered

- Exposing canvas elements or Pinia stores would couple extensions to internal
  representation and allow changes that bypass history and GPU synchronization.
- A built-in segmentation provider would move tool-specific UX into the
  frontend and exclude extensions needing a different prompt workflow.
- Passing files between separate dialogs works today but does not support
  selecting points and refining a mask in one editor.

## Consequences

The initial API supports replacing a mask and displaying point markers. More
overlay primitives and compositing modes can be added when a caller requires
them. The base-image snapshot intentionally excludes paint; extensions needing
composite-image inference require an explicit future contract.

Switching tools disposes their sessions. Extensions should keep persistent
settings outside the session, while image-specific prompts start fresh.
Image uploads and node widget serialization continue through native Save.
