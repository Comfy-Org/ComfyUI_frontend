# Security Policy

## Reporting a Vulnerability

This package is developed in the
[`Comfy-Org/ComfyUI_frontend`](https://github.com/Comfy-Org/ComfyUI_frontend)
monorepo under `packages/comfy-multi-player`. Report vulnerabilities through
that repository's **private vulnerability reporting**
(<https://github.com/Comfy-Org/ComfyUI_frontend/security/advisories/new>), or
by email to support@comfy.org, not in a public issue or pull request. Name
`@comfyorg/comfy-multi-player` in the report. Private reports are visible only
to repository maintainers and let you attach reproduction details without
exposing them publicly.

Expect an acknowledgement within **5 business days**.  A first assessment
(severity, scope, whether it is accepted) follows within **14 days**.  If no
response arrives in that window, re-open the report or contact a maintainer
directly.

Do not publish vulnerability details until a fix is released and affected
consumers have had a reasonable window to update.

## Supported Versions

Only the **latest published release** receives security fixes.  The package is
pinned by exact version (`"@comfyorg/comfy-multi-player": "0.3.10"`), so
consumers opt into upgrades deliberately — there are no automatic minor or
patch tracks.

| Version | Supported          |
|---------|--------------------|
| latest  | :white_check_mark: |
| older   | :x:                |

## Scope

This package (`@comfyorg/comfy-multi-player`) is the shared CRDT op applier and
JSON projection consumed by the browser and the server doc host.  Vulnerabilities
in the op application logic, stamp ordering, or projection that could cause
divergent state across peers are in scope and high-priority.

Dependency vulnerabilities are handled through the frontend repository's
Dependabot alerts and configuration.  Vulnerabilities in upstream packages
should be reported to their respective maintainers; file a private report only
if the vulnerability is exploitable through this package's usage of the
dependency.
