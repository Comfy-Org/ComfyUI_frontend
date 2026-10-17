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
Show loading on that row and reveal the conversation only after both succeed,
except as amended below.
Keep the row in its existing section until then. The Current marker follows
successful session activation, not the transport thread ID set before hydration.
Startup marks the stored session Current only after its transcript and workflow
are ready; a remount whose target is already decided has nothing to restore, so
it preserves its current identity. A failed startup restoration leaves the
session unmarked until a successful retry.
Failures remain in history with a retry affordance and existing error details;
the selected row is their only feedback. A chat whose recorded workflow returns
404 from its direct lookup opens without a target, even if a stale local
binding still names a tab, and the
composer tip says the target workflow is no longer available until a workflow is
chosen, New Chat starts or another chat is selected. Deleting the saved file of
the open chat's target shows the same notice; closing its tab, or discarding an
unsaved target, only clears the target. The panel never keeps a closed target's
workflow object alive. Legacy chats without a
recorded workflow can open without one. A restoration that fails with no loading
history row on screen, such as at startup, reports that the target workflow
could not be opened.

The panel store owns navigation presentation across panel remounts; the panel
supplies the current-selection guard to session loading. Workflow restoration reports success instead of treating
completion as readiness. The workflow service checks the guard before queued
work and after remote loading, before starting graph activation. Graph activation
continues to use the existing serialized loader; it is not a rollback transaction.

Other rows and New Chat remain available. A superseded result cannot reveal its
chat. Back during an unfinished or failed selection reloads the original chat
instead of exposing whichever transcript has partially hydrated underneath,
unless the Current chat is still loaded with its retained target; then Back
returns to it without retrying the switch.
Closing the panel preserves history and makes an interrupted selection retryable.
Remounting in that state subscribes to events without hydrating or activating the
unfinished transport thread. A history selection updates the persisted session
only after success. Deleting the previous Current chat cancels the unfinished
selection and removes the deleted Back destination.

If the resolver has already fetched the requested Cloud identity and can resolve
an open tab through its binding and ambiguity checks, restore that tab without
refreshing the Cloud catalog again. A persisted binding alone cannot take this
shortcut before the Cloud identity is known. Restoring a target that is
unknown, forgotten or closed, or that no open tab matches, still refreshes Cloud
metadata. The saved catalog is consulted before synchronizing it. This reuses
the panel's existing metadata lifetime; changes made elsewhere become visible at
the next refresh.

Current remains clickable. When its session and retained target are still
loaded, reuse them without fetching the transcript; an open target is not
resolved against Cloud again. The workflow service returns immediately for an
already visible target when no graph load is queued; otherwise, keep row loading
until the target is visible. Preserve the draft and active run. The Current
label alone does not enable this path: the session ID must still match, the
session must have completed hydration or accepted a turn in this mounted
instance, and its target must be retained, either as an open workflow or as the
unresolved target described below. Any other empty target, such as one cleared
by closing its tab or by a failed restoration, is restored again. A partially
restored selection or an interrupted return after remount uses the normal
guarded restoration path.

Closing-related chat transitions are a separate change. This decision does not
define whether closing an active Agent target should stop or background its run.

## Consequences

The user gets one visible transition into a usable conversation, at the cost of
waiting for workflow readiness before reading it. Back may need another fetch.
The session's underlying data can hydrate while history remains visible; the
panel must not use thread-ID changes alone as proof of navigation success.
The Cloud listing can omit live, version-less drafts. A successful listing that
includes the workflow shows that it exists, even when the listing is
incomplete. Only a complete listing that omits it points to absence, and a
failed or superseded listing points to neither. A direct lookup of the workflow
decides when a complete listing omits it. It also decides when no local target
answers and the listing cannot place the workflow: the listing failed, was
superseded, or is incomplete and omits it. Only a 404 from that lookup shows
that the workflow is gone; any other failure is inconclusive.

## Amendment (2026-10-15): Readable History with an Unresolved Target

A loaded conversation remains readable when no local target resolves after
saved-catalog synchronization, unless a direct lookup shows that the workflow is
gone. That covers a workflow a successful Cloud listing includes. It also covers
one the listing omits or cannot place when the lookup finds it live or cannot
tell, as with a 403, a server error or no connection. Local identity resolution
stays conservative: missing files, missing names, ambiguous names and refused
bindings do not justify choosing another canvas. A failed, timed-out or
superseded listing also leaves no names to match, so a saved local file can stay
unresolved until Cloud answers. The chat keeps an unresolved target: it has no
workflow, and the chat stays readable. When a successful Cloud listing named the
workflow, Current reuses it without restoring again. Otherwise Current resolves
the workflow again from the loaded transcript without fetching it; a retry that
still cannot place it leaves the chat readable with no failure row or warning.
A retry that finds the workflow but cannot open it marks the row "Could not
open" and keeps the unresolved target, so Back returns to the chat and Current
tries again.
While the retry runs, the chat keeps its unresolved target, so Back from History
returns to it. Leaving History by Back, another row, New Chat or closing the
panel cancels the retry and leaves the target unresolved; a graph load the retry
already started still finishes and is not rolled back. An agent tab activation
does not cancel the retry: when the retry then opens the workflow it found, that
workflow becomes the target and the visible graph, as at startup. Apart from
that, an unresolved target leaves the visible graph unchanged and does not show
the notice that the workflow is no longer available. Sending opens the workflow
picker and preserves the draft until the user explicitly chooses a target.
Passive tab changes and panel remounts do not resume following for that
conversation.

This exception provides conversation access, not workflow restoration. It does
not materialize Cloud content into a new editor tab or repair identity mapping.
Retryable failures remain for a transcript that fails to load and for a found
workflow that fails to open. When the saved workflow list fails to sync, the
workflow is treated as not found locally.

An agent tab activation applies only if, when it runs, the chat it came from is
still the open chat. While History is open, that is the Current chat, the chat
History was opened over, or the row still loading. A chat whose own History
row failed does not count. When the check fails, the activation is
dropped, so an earlier chat does not set the target of the chat on screen.
These cancel a pending activation:

- a newer activation;
- selecting a History row, unless it reuses the loaded Current chat, including
  when Current resolves an unresolved target again;
- New Chat, including deleting the open chat;
- the server deleting the open chat;
- closing the panel.

While a History selection has failed, an activation from the chat that failed
to open is dropped when it reaches its next check. Deleting the failed row
keeps dropping it.

Cancellation does not make graph activation a rollback transaction.
