# ADR-CLOUD-HANDOFF-0053: Desktop workflows cross through the local browser

Date: 2026-11-06

## Status

Proposed

## Context

Desktop opens external links in the system browser. That browser has no opener
relationship with the embedded editor, so the browser-to-browser message
handoff cannot carry its workflow. A workflow embedded in the external-open
URL also encounters operating-system URL length limits.

## Decision

Stage a short-lived transfer record through ComfyUI's existing userdata API.
Open a short local relay URL in the system browser. The relay reads and deletes
that record, then navigates its own tab to Cloud with a compressed workflow in
the URL fragment. The large payload never crosses the operating-system
external-open boundary or appears in an HTTP request URL.

Cloud removes the fragment before initializing telemetry or routing, keeps the
transfer in that tab's session storage through sign-in, and consumes it through
the existing workflow validator. Transfers expire after ten minutes. Encoded
and decompressed payload limits bound browser resource use. Unsupported or
failed staging retains the existing file-download fallback.

Use the published native-host bridge as well as the legacy Desktop distribution
to choose this transport. Newer Desktop hosts serve localhost frontend builds.

## Consequences

No new Cloud API, cross-origin upload permission or Desktop bridge version is
required. Local userdata must be available. A stopped Desktop process can leave
an expired transfer record on the local installation; the receiver refuses it.
The browser relay deletes a successfully consumed record, and the originating
editor also schedules its deletion at expiry while it remains open.

Direct external links containing the full workflow were rejected because of
operating-system length limits. A Cloud storage handoff would require a new
authentication and cross-origin upload contract. Treating an Electron popup as
a browser tab was rejected because the host deliberately opens it externally.
