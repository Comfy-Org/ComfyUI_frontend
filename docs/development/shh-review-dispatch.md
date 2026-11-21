# SHH review dispatch

The dispatcher is disabled until `SWARMHOST_REVIEW_ENABLED` is `true`.
It sends eligible PR metadata to a published SwarmHost playbook. It does
not review code, post comments, approve PRs, or wait for the review to finish.

Configure these repository variables before enabling it:

| Variable                            | Value                                      |
| ----------------------------------- | ------------------------------------------ |
| `SWARMHOST_REVIEW_ENABLED`          | `true` to enable; any other value disables |
| `SWARMHOST_REVIEW_PLAYBOOK_ID`      | Published playbook UUID                    |
| `SWARMHOST_REVIEW_PLAYBOOK_VERSION` | Explicit positive version number           |
| `SWARMHOST_REVIEW_PROJECT_ID`       | Target project UUID                        |

Set the repository secret `SWARMHOST_TOKEN` to an authorized dispatch token.
The destination is fixed to `https://swarmhost.engcomfy.com`.
The playbook must accept `repo_full_name`, `pr_number`, `head_sha`, and
`pr_url` as string parameters. Its runner must recheck live eligibility and
stop if `head_sha` is superseded before reviewing or publishing findings.

Opened, reopened, ready-for-review, review-requested, assigned, and synchronize
events trigger a fresh GitHub metadata lookup. Only open, non-draft PRs assigned
to or requesting review from `huang47` qualify. PRs authored by `huang47` are
excluded. Delayed events use the current head, not the event's head snapshot.
Removing assignment or closing a PR before the metadata lookup skips dispatch.
Changes after dispatch are handled by the playbook's preflight checks.

The privileged workflow executes only the default branch's dispatcher. It does
not check out PR code or install repository dependencies. Its GitHub token has
read-only contents and PR permissions. PR titles and bodies are never forwarded.
The separate test workflow can execute PR test changes but has no dispatch token.

Each repository, PR number, and head SHA produces a stable `client_request_id`.
SwarmHost deduplicates repeated POSTs, including workflow reruns. A new head gets
a new key. Changing the configured playbook version does not force a second
review of the same head. HTTP failures or failed dispatch rows fail the job;
successful dispatch only means accepted, not a completed review.

Run the offline suite with Node 24 or newer:

```sh
node --test .github/scripts/dispatch-shh-review.test.ts
```

For a pilot, merge the configuration, publish the compatible playbook, configure
the variables and secret, then enable dispatch. Request review on one eligible
PR and inspect the resulting dispatch in SwarmHost. Rerun the Actions job to
verify that the same dispatch is returned. Disable the variable to stop new
dispatches; already dispatched runs must be managed in SwarmHost.
