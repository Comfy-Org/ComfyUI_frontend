# Security Policy

## Reporting a Vulnerability

Use **GitHub's private vulnerability reporting** (Security tab → "Report a
vulnerability"), not a public issue or pull request.  Private reports are
visible only to repository maintainers and let you attach reproduction details
without exposing them publicly.

Expect an acknowledgement within **5 business days**.  A first assessment
(severity, scope, whether it is accepted) follows within **14 days**.  If no
response arrives in that window, re-open the report or contact a maintainer
directly.

Do not publish vulnerability details until a fix is released and affected
consumers have had a reasonable window to update.

## Supported Versions

Only the **latest published release** receives security fixes.  The package is
pinned by exact version (`"@comfyorg/comfy-multi-player": "0.2.0"`), so
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

Dependency vulnerabilities are handled through Dependabot alerts and the
configuration in `.github/dependabot.yml`.  Vulnerabilities in upstream
packages should be reported to their respective maintainers; file a private
report here only if the vulnerability is exploitable through this package's
usage of the dependency.
