# ADR-AGENT-HISTORY-0038: Wait for Chat and Workflow Readiness

Date: 2026-09-25

## Status

Proposed

## Context

A historical chat may refer to a saved workflow whose editor tab was closed.
Showing its conversation immediately exposes a period with no usable target.
A composer spinner would explain the delay but would still expose that partial
state. Closing a tab does not delete the saved workflow or its conversation.

## Decision

Keep the history list visible while a selected chat and its workflow open.
Show loading on that row and reveal the conversation only after both succeed.
Keep the row in its existing section until then. The Current marker follows
successful session activation, not the transport thread ID set before hydration.
Mounting an existing session preserves its current identity; the readiness wait
applies to selecting a different conversation from history.
Failures remain in history with a retry affordance and existing error details.
Legacy chats without a recorded workflow can open without one.

The panel store owns navigation presentation across panel remounts; the panel
supplies the current-selection guard to session loading. Workflow restoration reports success instead of treating
completion as readiness. The workflow service checks the guard before queued
work and after remote loading, before starting graph activation. Graph activation
continues to use the existing serialized loader; it is not a rollback transaction.

Other rows and New Chat remain available. A superseded result cannot reveal its
chat. Back during an unfinished or failed selection reloads the original chat
instead of exposing whichever transcript has partially hydrated underneath.
Closing the panel preserves history and makes an interrupted selection retryable.
Remounting in that state subscribes to events without hydrating or activating the
unfinished transport thread. A history selection updates the persisted session
only after success. Deleting the previous Current chat cancels the unfinished
selection and removes the deleted Back destination.

If the resolver has already fetched the requested Cloud identity and can resolve
an open tab through its binding and ambiguity checks, restore that tab without
refreshing the Cloud catalog again. A persisted binding alone cannot take this
shortcut before the Cloud identity is known. Unknown, forgotten, unresolved and
closed targets still refresh Cloud metadata. The saved catalog is consulted
before synchronizing it. This reuses the panel's existing metadata lifetime;
changes made elsewhere become visible at the next refresh.

Current remains clickable. When its session and retained target are still
loaded, reuse them without fetching the transcript or resolving Cloud identity
again. The workflow service returns immediately for an already visible target
when no graph load is queued; otherwise, keep row loading until the target is
visible. Preserve the draft and active run. The Current label alone does not
enable this path: the session ID must still match, the session must have completed
hydration or accepted a turn in this mounted instance, and its target must be
retained. A partially restored selection or an interrupted return after remount
uses the normal guarded restoration path.

Closing-related chat transitions are a separate change. This decision does not
define whether closing an active Agent target should stop or background its run.

## Consequences

The user gets one visible transition into a usable conversation, at the cost of
waiting for workflow readiness before reading it. Back may need another fetch.
The session's underlying data can hydrate while history remains visible; the
panel must not use thread-ID changes alone as proof of navigation success.
