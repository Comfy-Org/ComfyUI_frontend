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

The required `lint-and-format` context keeps one stable name across pull requests and merge-queue
candidates. Changes confined to `apps/website/**` run website-scoped lint, format, typecheck, and
Knip jobs. Any file outside that directory selects the full repository jobs; pushes to protected
branches always run the full jobs.

For GitHub Actions documentation, see [Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows).

## Website auto-approval

`pr-website-auto-approve.yaml` removes the human approval wait for explicitly
allowlisted authors when every changed file is under `apps/website/**`. It runs
from the protected default branch on `pull_request_target`, never executes PR code,
rejects other base branches and fork pull requests, rechecks the live head, and verifies that
`WEBSITE_APPROVAL_TOKEN` belongs to `webreviewer-bot` before approving. The bot is a member of
`comfy_website_devs`, so its review satisfies the website path reviewer rule.

The `website-fast-lane:hold` label, draft state, an active non-app reviewer change request, a base
or head change, or a path outside `apps/website/**` stops approval and withdraws an existing
current-head policy approval. The review body identifies the verdict as policy-only; it must not be
interpreted as a diff review.

The initial author allowlist contains only `bertfy`. Expand it by reviewing a
change to `WEBSITE_AUTO_APPROVE_AUTHORS` in the workflow. A repository
administrator must provide the bot's classic PAT as the Actions secret
`WEBSITE_APPROVAL_TOKEN`; missing or mismatched credentials fail closed.

## Website production identity and validation rollback

Every website preview and production build writes a cache-disabled `/__build.json` containing the
repository, exact source SHA, workflow run, attempt, and build time. The deploy workflow verifies
the immutable Vercel URL before it accepts canonical `comfy.org` promotion and retains the prior
deployment ID/SHA as a short-lived artifact.

`validation-website-rollback.yaml` is a manually dispatched validation-only workflow. It accepts
that captured immutable deployment ID and expected SHA, uses Vercel's instant rollback, verifies
the canonical marker and public homepage, then promotes the same known-good deployment to preserve
it while resuming normal automatic production-domain assignment.
