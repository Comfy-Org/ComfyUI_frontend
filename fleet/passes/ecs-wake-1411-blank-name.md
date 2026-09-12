# ECS-QA-031 receipt

- Added both-renderer coverage for a promoted text widget cleared through the host UI.
- Verified save POST status 200, no error toast, persisted blank value after reload, and unchanged host type/subgraph identity.
- Focused run: 2 passed with one Playwright worker and the shared browser lock.
- Mutation control changed the persisted blank assertion to `mutation-control`: 2 failed with received value `""`; reverted before commit.
- State: pending CI on PR #17516.
