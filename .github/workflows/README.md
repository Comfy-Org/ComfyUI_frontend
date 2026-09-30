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

For GitHub Actions documentation, see [Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows).

## Enable the main approval policy

`ci-approval-policy.yaml` signals PR, review, and merge-group changes without
credentials or a checkout. `pr-approval-policy.yaml` runs code from `main`
and publishes the **`approval-policy`** check through a dedicated GitHub App.
The evaluator uses GitHub's workflow-run metadata and live API responses;
it does not download or execute PR artifacts.

Website-only PRs require one approval from either `comfy_frontend_devs` or
`comfy_website_devs`. Any outside path, including the old path of a rename,
requires frontend approval. The approval must cover the current head commit
and come from someone other than the author. CODEOWNERS remains unchanged
and continues to request specialist reviews.

1. Create a dedicated GitHub App and install it on `Comfy-Org/ComfyUI_frontend`.
   Grant repository **Checks: write**, **Contents: read**, and **Pull requests:
   read**, plus organization **Members: read**. Do not grant bypass rights.
2. Create the GitHub Actions environment `approval-policy`. Under deployment
   branches and tags, allow only the branch `main`, with no tag rules. Do not
   use the broader "Protected branches only" option. Put
   `APPROVAL_POLICY_APP_PRIVATE_KEY` in this environment's secrets, never in
   repository or organization secrets. Set `APPROVAL_POLICY_APP_ID` as an
   environment variable in the GitHub configuration variables section.
   This restriction prevents PR-controlled workflows from obtaining the key.
3. Merge the workflows before enabling their check as required. The trusted
   `workflow_run` consumer only becomes active once it exists on `main`.
4. Run `PR: Approval Policy` on `main` with a representative `pull-request`
   number. Verify that the PR receives `approval-policy` from the dedicated
   App. Test website-only approvals from each team, outside and mixed PRs,
   cross-directory renames, dismissed approvals, and a push after approval.
   Verify a fork review and a multi-PR merge group before removing the old
   team requirements.
5. In `ProtectMain`, add the required check **`approval-policy`**, selecting
   the dedicated App as its expected source. Do not select GitHub Actions,
   "any source", `signal`, or `evaluate`. Keep all existing CI checks and
   the merge queue.
6. Remove both existing required-team reviewer entries in `ProtectMain`.
   Keep one native required approval and enable stale-review dismissal in
   that ruleset. Leave required CODEOWNERS review disabled and preserve
   existing bypass actors and other rulesets. Native review requirements
   continue to block changes-requested reviews and enforce GitHub's own
   approval rules.

Each evaluation also refreshes active merge-group checks. A group passes
only if every included PR has an eligible approval, including when the queue
uses `HEADGREEN`. Incomplete file lists, unreadable membership, and changes
during evaluation fail the check. Queues over 100 entries stop evaluation
rather than approving a partial view.

Actions delivery is asynchronous. A previously successful check can remain
green until a dismissal event is processed. Team-membership changes do not
trigger this workflow; run `PR: Approval Policy` manually after such changes.
Native one-approval protection does not close the team-policy delay when
another, ineligible approval remains. Do not treat this workflow as atomic
authorization at merge time. Retain native team enforcement if that delay is
unacceptable.

If the publisher fails before creating a check, or cannot update GitHub, stop
merging affected PRs and rerun after fixing the error. Do not remove the
required check to unblock them. For rollback, restore the original team
requirements before removing `approval-policy` from required checks.

Run the local policy tests with:

```sh
pnpm test:unit scripts/cicd/approval-policy.test.ts --retry=0
```
