---
name: regenerating-screenshots
description: 'Creates a PR to regenerate Playwright screenshot expectations. Use when screenshot tests are failing on main or PRs due to stale golden images. Triggers on: regen screenshots, regenerate screenshots, update expectations, fix screenshot tests.'
---

# Regenerating Playwright Screenshot Expectations

Automates the process of triggering the `PR: Update Playwright Expectations`
GitHub Action by creating a labeled PR from `origin/main`.

## Steps

1. **Fetch latest main**

   ```bash
   git fetch origin main
   ```

2. **Create a timestamped branch** from `origin/main`

   Format: `regen-screenshots/YYYY-MM-DDTHH` (hour resolution, local time)

   ```bash
   git checkout -b regen-screenshots/<datetime> origin/main
   ```

3. **Create an empty commit**

   ```bash
   git commit --allow-empty -m "test: regenerate screenshot expectations"
   ```

4. **Push the branch**

   ```bash
   git push origin regen-screenshots/<datetime>
   ```

5. **Generate a poem** about regenerating screenshots. Be creative — a
   new, unique poem every time. Short (4–8 lines). Can be funny, wistful,
   epic, haiku-style, limerick, sonnet fragment — vary the form.

6. **Create the PR** with the poem as the body (no label yet).

   Write the poem to a temp file and use `--body-file`:

   ```bash
   # Write poem to temp file
   # Create PR:
   gh pr create \
     --base main \
     --head regen-screenshots/<datetime> \
     --title "test: regenerate screenshot expectations" \
     --body-file <temp-file>
   ```

7. **Add the label** as a separate step to trigger the GitHub Action.

   The `labeled` event only fires when a label is added after PR
   creation, not when applied during creation via `--label`.

   Use the GitHub API directly (`gh pr edit --add-label` fails due to
   deprecated Projects Classic GraphQL errors):

   ```bash
   gh api repos/{owner}/{repo}/issues/<pr-number>/labels \
     -f "labels[]=New Browser Test Expectations" --method POST
   ```

8. **Report the result** to the user:
   - PR URL
   - Branch name
   - Note that the GitHub Action will run automatically and commit
     updated screenshots to the branch.

## Notes

- The `New Browser Test Expectations` label triggers the
  `pr-update-playwright-expectations.yaml` workflow.
- The workflow runs Playwright with `--update-snapshots`, commits results
  back to the PR branch, then removes the label.
- This is fire-and-forget — no need to wait for or monitor the Action.
- Always return to the original branch/worktree state after pushing.
