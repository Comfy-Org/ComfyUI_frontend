# GitHub Workflows

## Naming Convention

Workflow files follow a consistent naming pattern: `<prefix>-<descriptive-name>.yaml`

### Category Prefixes

| Prefix     | Purpose                             | Example                              |
| ---------- | ----------------------------------- | ------------------------------------ |
| `ci-`      | Testing, linting, validation        | `ci-tests-e2e.yaml`                  |
| `release-` | Version management, publishing      | `release-version-bump.yaml`          |
| `pr-`      | PR automation (triggered by labels) | `pr-claude-review.yaml`              |
| `api-`     | External Api type generation        | `api-update-registry-api-types.yaml` |
| `i18n-`    | Internationalization updates        | `i18n-update-core.yaml`              |

## Documentation

Each workflow file contains comments explaining its purpose, triggers, and behavior. For specific details about what each workflow does, refer to the comments at the top of each `.yaml` file.

The candidate dependency prototype lives in `ci-tests-e2e.yaml`. See
[CI-PREREQUISITES-0038](../../docs/adr/CI-PREREQUISITES-0038-gate-expensive-candidate-tests.md)
for measured runtimes, required-check compatibility, and rollout limits.

For GitHub Actions documentation, see [Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows).

## Website auto-approval

`pr-website-auto-approve.yaml` removes the human approval wait for explicitly
allowlisted authors when every changed file is under `apps/website/**`. It runs
from the protected default branch on `pull_request_target`, never executes PR code,
rejects other base branches and fork pull requests, rechecks the live head, and verifies that
`WEBSITE_APPROVAL_TOKEN` belongs to `webreviewer-bot` before approving. The bot is a member of
`comfy_website_devs`, so its review satisfies the website path reviewer rule.

The initial author allowlist contains only `bertfy`. Expand it by reviewing a
change to `WEBSITE_AUTO_APPROVE_AUTHORS` in the workflow. A repository
administrator must provide the bot's classic PAT as the Actions secret
`WEBSITE_APPROVAL_TOKEN`; missing or mismatched credentials fail closed.
