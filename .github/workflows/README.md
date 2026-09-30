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
It also handles PR conversation comment creation, edits, and deletions through
`issue_comment`. The evaluator uses GitHub's event metadata and live API
responses; it does not download PR artifacts or execute comment text.

Website-only PRs require one approval from either `comfy_frontend_devs` or
`comfy_website_devs`. Any outside path, including the old path of a rename,
requires frontend approval. The approval must cover the current head commit
and come from someone other than the author. CODEOWNERS remains unchanged
and continues to request specialist reviews.

To bypass the approval requirement, the PR author can post a conversation
comment containing exactly `To Be Reviewed`. Surrounding whitespace is ignored.
The phrase is case-sensitive. Other people's comments, bot comments, inline
review comments, and quoted or embedded phrases do not count. The check links
to the author's comment so the bypass is visible.

Use this for urgent changes when an approver is unavailable. The comment records
that review is deferred, not completed. Once `approval-policy` passes, use
**Add to merge queue**, not GitHub's bypass option. CI and the merge queue remain
mandatory; the workflow neither merges the PR nor grants GitHub bypass rights.

The override applies to the entire PR, including later pushes and merge groups.
Edit or delete all matching comments to revoke it. Any human PR author,
including a fork author, can request it. The workflow does not enforce an
urgency threshold, a waiting period, or eventual review after merge.

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
   Verify an author override with zero approvals, rejection of another person's
   comment, and revocation after an edit or deletion. Test fork comments and
   reviews and a multi-PR merge group before removing the old requirements.
5. In `ProtectMain`, add the required check **`approval-policy`**, selecting
   the dedicated App as its expected source. Do not select GitHub Actions,
   "any source", `signal`, or `evaluate`. Keep all existing CI checks and
   the merge queue.
6. Remove both existing required-team reviewer entries in `ProtectMain`.
   Set native required approvals to **0** in both `ProtectMain` and
   `ProtectMainReview`, and audit any other rulesets or branch protection
   applying to `main`. Keep the pull-request requirement itself. Leave
   required CODEOWNERS review and last-push approval disabled. Retain
   unrelated protections. A required check cannot
   waive native approval requirements, so retaining one approval would block
   the zero-approval author override. Verify effective merge eligibility,
   including outstanding changes-requested reviews, before rollout is complete.
7. Remove broad bypass grants from authors who will use deferred approval.
   `ProtectMain` currently grants `RepositoryRole` 5 an `always` bypass over
   its review, CI, and merge-queue rules together. Remove that entry to require
   those authors to use the queue. If separate emergency bypass rights must
   remain, put mandatory CI and merge-queue rules in a separate active `main`
   ruleset with no bypass grants for those authors. Review-only bypass grants
   cannot waive a separate ruleset's queue requirement.
8. Verify with an affected author's account that `To Be Reviewed` allows queue
   entry with zero approvals, failing CI still prevents merging, and direct
   merge without the queue is unavailable. A successful `approval-policy`
   check alone does not prove that GitHub enforces the queue.

Each evaluation also refreshes active merge-group checks. A group passes
only if every included PR has an eligible approval or its own author override,
including when the queue uses `HEADGREEN`. Incomplete file lists, unreadable
membership or comments, and changes during evaluation fail the check. Queues
over 100 entries stop evaluation rather than approving a partial view.

Actions delivery is asynchronous. A previously successful check can remain
green until a review dismissal or override removal event is processed.
Team-membership changes do not trigger this workflow; run `PR: Approval Policy`
manually after such changes. Do not treat this workflow as atomic authorization
at merge time. Retain native team enforcement if that delay is unacceptable;
the comment override cannot bypass those native requirements.

If the publisher fails before creating a check, or cannot update GitHub, stop
merging affected PRs and rerun after fixing the error. Do not remove the
required check to unblock them. For rollback, restore the original team
and native approval requirements before removing `approval-policy` from
required checks.

Run the local policy tests with:

```sh
pnpm test:unit scripts/cicd/approval-policy.test.ts --retry=0
```
