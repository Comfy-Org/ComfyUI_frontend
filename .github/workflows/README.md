# GitHub Workflows

## Naming Convention

Workflow files follow a consistent naming pattern: `<prefix>-<descriptive-name>.yaml`

### Category Prefixes

| Prefix        | Purpose                                   | Example                              |
| ------------- | ----------------------------------------- | ------------------------------------ |
| `ci-`         | Testing, linting, validation              | `ci-tests-e2e.yaml`                  |
| `release-`    | Version management, publishing            | `release-version-bump.yaml`          |
| `pr-`         | PR automation (triggered by labels)       | `pr-claude-review.yaml`              |
| `api-`        | External Api type generation              | `api-update-registry-api-types.yaml` |
| `i18n-`       | Internationalization updates              | `i18n-update-core.yaml`              |
| `validation-` | Manually dispatched production validation | `validation-website-rollback.yaml`   |

## Documentation

Each workflow file contains comments explaining its purpose, triggers, and behavior. For specific details about what each workflow does, refer to the comments at the top of each `.yaml` file.

The candidate dependency prototype lives in `ci-tests-e2e.yaml`. See
[CI-PREREQUISITES-0038](../../docs/adr/CI-PREREQUISITES-0038-gate-expensive-candidate-tests.md)
for measured runtimes, required-check compatibility, and rollout limits.

The required `lint-and-format` context keeps one stable name across pull requests and merge-queue
candidates. See [Package delivery lanes](../../docs/architecture/package-delivery-lanes.md) for the
path-scoped quality and approval model, and [Website delivery validation](../../docs/architecture/website-delivery-validation.md)
for the current trial and rollback procedure.

For GitHub Actions documentation, see [Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows).
