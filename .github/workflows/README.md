# GitHub Workflows

This directory contains GitHub Actions workflow files that automate various aspects of the ComfyUI frontend development and release process.

> **Note:** This documentation is auto-generated from workflow files. Do not edit manually.
> Run `pnpm workflow:docs` to regenerate.

## Naming Convention

Workflow files follow a consistent naming pattern: `<prefix>-<descriptive-name>.yaml`

### Category Prefixes

| Prefix     | Purpose                             | Example                              |
| ---------- | ----------------------------------- | ------------------------------------ |
| `ci-` | Testing, linting, validation | `ci-json-validation.yaml` |
| `pr-` | PR automation (triggered by labels) | `pr-backport.yaml` |
| `release-` | Version management, publishing | `release-branch-create.yaml` |
| `api-` | External API type generation | `api-update-electron-api-types.yaml` |
| `i18n-` | Internationalization updates | `i18n-update-core.yaml` |
| `publish-` | Publishing and deployment | `publish-desktop-ui-on-merge.yaml` |
| `version-` | Version management | `version-bump-desktop-ui.yaml` |


## Quick Reference

For label-triggered workflows, add the corresponding label to a PR to trigger the workflow:
- `New Browser Test Expectations` - Updates Playwright test snapshots when triggered by label or comment
- `Release` - Triggers 3 workflows
- `claude-review` - AI-powered code review triggered by adding the 'claude-review' label to a PR
- `needs-backport` - Automatically backports merged PRs to release branches when 'needs-backport' label is applied

For manual workflows, use the "Run workflow" button in the Actions tab.


## Workflow Details


### CI

#### [`ci-json-validation.yaml`](./ci-json-validation.yaml)

**Name:** CI: JSON Validation

**Description:** Validates JSON syntax in all tracked .json files (excluding tsconfig*.json) using jq

**Triggers:** push

#### [`ci-lint-format.yaml`](./ci-lint-format.yaml)

**Name:** CI: Lint Format

**Description:** Linting and code formatting validation for pull requests

**Triggers:** pull_request

#### [`ci-python-validation.yaml`](./ci-python-validation.yaml)

**Name:** CI: Python Validation

**Description:** Validates Python code in tools/devtools directory

**Triggers:** pull_request, push

#### [`ci-tests-e2e-forks.yaml`](./ci-tests-e2e-forks.yaml)

**Name:** CI: Tests E2E (Deploy for Forks)

**Description:** Deploys test results from forked PRs (forks can't access deployment secrets)

#### [`ci-tests-e2e.yaml`](./ci-tests-e2e.yaml)

**Name:** CI: Tests E2E

**Description:** End-to-end testing with Playwright across multiple browsers, deploys test reports to Cloudflare Pages

**Triggers:** pull_request, push

#### [`ci-tests-storybook-forks.yaml`](./ci-tests-storybook-forks.yaml)

**Name:** CI: Tests Storybook (Deploy for Forks)

**Description:** Deploys Storybook previews from forked PRs (forks can't access deployment secrets)

#### [`ci-tests-storybook.yaml`](./ci-tests-storybook.yaml)

**Name:** CI: Tests Storybook

**Description:** Builds Storybook and runs visual regression testing via Chromatic, deploys previews to Cloudflare Pages

**Triggers:** workflow_dispatch (manual), pull_request

#### [`ci-tests-unit.yaml`](./ci-tests-unit.yaml)

**Name:** CI: Tests Unit

**Description:** Unit and component testing with Vitest

**Triggers:** pull_request, push

#### [`ci-workflow-docs.yaml`](./ci-workflow-docs.yaml)

**Name:** CI: Workflow Documentation

**Description:** Validates that workflow documentation is up-to-date with workflow files

**Triggers:** pull_request


### PR

#### [`pr-backport.yaml`](./pr-backport.yaml)

**Name:** PR Backport

**Description:** Automatically backports merged PRs to release branches when 'needs-backport' label is applied

**Triggers:** workflow_dispatch (manual), pull_request_target (closed, labeled)

**Label Triggers:** `needs-backport`

#### [`pr-claude-review.yaml`](./pr-claude-review.yaml)

**Name:** PR: Claude Review

**Description:** AI-powered code review triggered by adding the 'claude-review' label to a PR

**Triggers:** pull_request (labeled)

**Label Triggers:** `claude-review`

#### [`pr-update-playwright-expectations.yaml`](./pr-update-playwright-expectations.yaml)

**Name:** PR: Update Playwright Expectations

**Description:** Updates Playwright test snapshots when triggered by label or comment

**Triggers:** pull_request (labeled), issue_comment (created)

**Label Triggers:** `New Browser Test Expectations`, `/update-playwright`


### RELEASE

#### [`release-branch-create.yaml`](./release-branch-create.yaml)

**Name:** Release Branch Create

**Description:** Creates release branch when version bump PR with 'Release' label is merged

**Triggers:** pull_request (closed)

**Label Triggers:** `Release`

#### [`release-draft-create.yaml`](./release-draft-create.yaml)

**Name:** Release Draft Create

**Description:** Creates GitHub release draft when version bump PR with 'Release' label is merged

**Triggers:** pull_request (closed)

**Label Triggers:** `Release`

#### [`release-npm-types.yaml`](./release-npm-types.yaml)

**Name:** Release NPM Types

**Description:** Manual workflow to publish TypeScript type definitions to npm

**Triggers:** workflow_dispatch (manual)

#### [`release-pypi-dev.yaml`](./release-pypi-dev.yaml)

**Name:** Release PyPI Dev

**Description:** Manual workflow to publish development version to PyPI

**Triggers:** workflow_dispatch (manual)

#### [`release-version-bump.yaml`](./release-version-bump.yaml)

**Name:** Release: Version Bump

**Description:** Manual workflow to increment package version with semantic versioning support

**Triggers:** workflow_dispatch (manual)


### API

#### [`api-update-electron-api-types.yaml`](./api-update-electron-api-types.yaml)

**Name:** Api: Update Electron API Types

**Description:** When upstream electron API is updated, click dispatch to update the TypeScript type definitions in this repo

**Triggers:** workflow_dispatch (manual)

#### [`api-update-manager-api-types.yaml`](./api-update-manager-api-types.yaml)

**Name:** Api: Update Manager API Types

**Description:** When upstream ComfyUI-Manager API is updated, click dispatch to update the TypeScript type definitions in this repo

**Triggers:** workflow_dispatch (manual)

#### [`api-update-registry-api-types.yaml`](./api-update-registry-api-types.yaml)

**Name:** Api: Update Registry API Types

**Description:** When upstream comfy-api is updated, click dispatch to update the TypeScript type definitions in this repo

**Triggers:** workflow_dispatch (manual)


### I18N

#### [`i18n-update-core.yaml`](./i18n-update-core.yaml)

**Name:** i18n: Update Core

**Description:** Generates and updates translations for core ComfyUI components using OpenAI

**Triggers:** workflow_dispatch (manual), pull_request (opened, synchronize, reopened)

#### [`i18n-update-custom-nodes.yaml`](./i18n-update-custom-nodes.yaml)

**Name:** i18n Update Custom Nodes

**Description:** Updates translations for custom node repositories using OpenAI

**Triggers:** workflow_dispatch (manual)

#### [`i18n-update-nodes.yaml`](./i18n-update-nodes.yaml)

**Name:** i18n Update Nodes

**Description:** Updates translations for ComfyUI node definitions

**Triggers:** workflow_dispatch (manual)


### PUBLISH

#### [`publish-desktop-ui-on-merge.yaml`](./publish-desktop-ui-on-merge.yaml)

**Name:** Publish Desktop UI on PR Merge

**Description:** Automatically publishes desktop UI package to npm when version bump PR is merged

**Triggers:** pull_request (closed)

**Label Triggers:** `Release`

#### [`publish-desktop-ui.yaml`](./publish-desktop-ui.yaml)

**Name:** Publish Desktop UI

**Description:** Manual workflow to publish desktop UI package to npm with specified version

**Triggers:** workflow_dispatch (manual)


### VERSION

#### [`version-bump-desktop-ui.yaml`](./version-bump-desktop-ui.yaml)

**Name:** Version Bump Desktop UI

**Description:** Manual workflow to increment desktop UI package version with semantic versioning support

**Triggers:** workflow_dispatch (manual)



## Documentation

For more information about GitHub Actions, see:
- [Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows)
- [Workflow syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)

## Maintaining Workflows

### Adding a New Workflow

1. Create a new workflow file following the naming convention
2. Include `name` and `description` fields at the top of the workflow
3. Run `pnpm workflow:docs` to update this README
4. Commit both the workflow file and updated README

### Best Practices

1. **Always include a description**: Add a `description` field after the `name` field
2. **Use consistent prefixes**: Follow the established prefix conventions
3. **Label-triggered workflows**: For PR automation, use the `pr-` prefix
4. **Document triggers**: Make trigger conditions clear in the workflow description
5. **Keep docs in sync**: Run `pnpm workflow:docs` after any workflow changes
