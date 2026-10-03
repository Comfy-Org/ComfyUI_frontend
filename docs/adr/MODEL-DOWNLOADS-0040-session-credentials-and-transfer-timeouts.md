# ADR-MODEL-DOWNLOADS-0040: Session Credentials and Transfer Timeouts

Date: 2026-10-02

## Status

Proposed

## Context

The missing-model download endpoint replies after the complete batch. The
frontend's default 60-second response-header timeout aborts legitimate large
downloads. Signing into Hugging Face in the browser does not authenticate a
download made by the ComfyUI server.

## Decision

Disable the frontend timeout only for the batch download request. Keep backend
connection and stalled-read limits, progress events, and cancellation. Retain
manual retries that restart the selected file; asynchronous job persistence and
partial-file resumption are outside this change.

Users can supply a read-capable Hugging Face token held in browser memory until
refresh or removal. Send it with each authorized batch and retain it on the
server only for that request. Never serialize it into settings or download
state. A server-wide credential would implicitly share one account's access
with other users, so it is not used here.

Only the exact HTTPS Hugging Face origin receives the Authorization header.
Recompute headers for each redirect; download CDN hosts do not receive the
token. Existing source and destination validation still applies.

An unauthenticated metadata probe identifies gated repositories, not whether
the supplied token has access. Actual download responses determine access;
license acceptance and approval remain on Hugging Face.

## Consequences

Users must trust the ComfyUI server receiving their token and provide the token
again after a page refresh. HTTP proxies may still impose independent timeouts.
Native Desktop and cloud download authentication remain separate.
