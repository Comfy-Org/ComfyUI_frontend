# ADR-AGENT-QUEUE-0051: Frontend Prompt Queue

Date: 2026-10-29

## Status

Accepted

## Context

Users can type follow-up prompts while a turn is still running. The agent
session refuses a second `sendMessage` until the current turn finishes. The
server returns a busy or turn-in-progress error. There is no backend queue for
composer prompts.

## Decision

Keep the executable prompt queue on the frontend. Show the active turn and
waiting prompts above the composer. Send the next waiting item only after the
current turn is no longer busy. An item being edited stays out of the
executable list and out of the header count until the user submits or cancels.

## Alternatives considered

- Call `sendMessage` for every submit and let the session record a busy
  notice: the follow-up is lost and the user sees an error.
- Add a server-side queue: needs a new API. Out of scope for this change.

## Consequences

Queued prompts live only in this page session. A new chat or a thread switch
clears them. A waiting prompt can be edited or deleted. The active prompt
cannot.
