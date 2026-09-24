# ADR-WORKSHOP-WORKFLOWS-0036: Published APP definitions and durable Cloud runs

Date: 2026-09-22

## Status

Superseded by [WORKSHOP-CATALOG-0037](WORKSHOP-CATALOG-0037-shared-pages-and-authored-execution-catalogs.md)
on 2026-09-23.

## Context

The initial FE-2736 proposal combined workflow pages with automatic APP binding
publication, a durable backend run service, Cloud submission receipts and owned
immutable media. The user clarified that publication data is prepared offline
and that the current feature must use existing public Cloud endpoints.

## Decision

Do not make the earlier infrastructure proposal a dependency of the frontend
feature. Reuse Models INPUTS with authored workflow JSONL and the existing Cloud
upload, prompt, job and output endpoints, as specified by WORKSHOP-CATALOG-0037.

The full historical proposal and implementation remain available on the
[frontend future branch](https://github.com/Comfy-Org/ComfyUI_frontend/tree/benjcooley/fe-2736-workshop-runtime-future)
and the deferred Cloud PRs [#10444](https://github.com/Comfy-Org/cloud/pull/10444),
[#10445](https://github.com/Comfy-Org/cloud/pull/10445) and
[#10470](https://github.com/Comfy-Org/cloud/pull/10470).

## Consequences

The frontend can ship without a new backend deployment. It uses native Cloud
semantics: known jobs can be observed again, but an uncertain submission cannot
be safely replayed automatically. Automatic publication, stronger durable
recovery and any new public backend contracts require a separately agreed scope
with the Cloud team.
