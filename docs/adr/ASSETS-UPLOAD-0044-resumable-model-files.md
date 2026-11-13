# ADR-ASSETS-UPLOAD-0044: Model files resume in the open editor

Date: 2026-11-06

## Status

Proposed

## Context

A dropped connection during a large model import should preserve the bytes
already held by storage. The upload API can return either a signed URL for
one PUT or a resumable session. Existing servers return only the former.

## Decision

Request a resumable session and use it only when the server names that mode.
Otherwise keep the single PUT. Send one file slice at a time, using the server's
piece size. Query storage after an uncertain result before sending more bytes.
Its held range, rather than browser progress events, decides where to resume.

Keep the session URL in the current upload attempt only. Cancel aborts its
request or retry wait. An expired session requires another upload attempt.
Never log the session URL or pass it to telemetry.

Start and completion name the editor as the client. Completion says whether
the transfer resumed: true only after a status query found nonzero held bytes
and the transfer continued from them, and absent for a single PUT. When start
advertises `upload_analytics_version` 1, a failed or canceled transfer sends
one coded report (reason, size, model folder, resume) that the caller never
waits for; it carries no file name, URL or error text.

## Alternatives

Raising the size limit alone leaves every interrupted transfer starting over.
Persisting sessions across page reloads requires file access and credential
storage beyond this upload attempt. A shared transfer framework would add
another abstraction for one caller.

## Consequences

The existing completion call and library task remain responsible for saving
the model. Reconnection uses exponential backoff capped at 60 seconds while
the attempt is open. Real browser CORS and large-file throughput require
verification against storage; transport doubles cannot establish them.
