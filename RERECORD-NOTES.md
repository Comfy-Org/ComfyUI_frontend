# Re-recording `agent-rec-batched-ops` to flip `test.fail()` in `agentLayoutQuality.spec.ts`

Investigation only — nothing here was executed, no fixture or spec was touched.
Row `layout-31` (in-app-agent program). Branch `test/agent-layout-quality-harness`, PR #17901.

---

## 1. What the marker is actually waiting on

`browser_tests/tests/agent/agentLayoutQuality.spec.ts` marks the batched overlap case
`test.fail()`. The failure is entirely a function of two numbers frozen into
`browser_tests/fixtures/data/agent/conversations/agent-rec-batched-ops.json`:

| recorded field                  | value          |
| ------------------------------- | -------------- |
| `add_node[0].pos`               | `[715, 280]`   |
| `add_node[1].pos`               | `[715, 406]`   |
| both `node.size`                | `[240, 86]`    |
| vertical stride (`dy`)          | `126`          |

Those were computed by the `comfy-cli` the recording agent shelled out to on
2026-09-03 (cloud commit `9dc1da7d`). The measurement in commit `48e8cf44ee`:
modelled occupancy `86 body + 30 title = 116` graph px against a `126` stride is a
10px clear gap; the browser actually draws `132` graph px, so the pair overlaps by
~6 graph px / 5.4 screen px at scale 0.9. The second reported failure in the same
commit — one new node overlapping seed node 3 (KSampler) by 95x11 — comes from the
first node being placed at `y=280` when KSampler's title-inclusive box ends at
`y=262`.

So the fixture is frozen evidence of the old placer, and the only way the assertion
flips is if the numbers in it change.

---

## 2. Which comfy-cli change actually moves the numbers

I ran the real `assign_positions` from three comfy-cli revisions against this
fixture's own seed graph and an equivalent batched spec
(2x `add_node CLIPTextEncode` + 2x `connect` from node 4's CLIP output). Harness in
the session scratchpad; `layout.py` is a pure module with no comfy_cli imports, so
this is the production placer, not a reimplementation.

| comfy-cli revision            | `estimate_size` CLIPTextEncode | placed `at`                      | `dy` |
| ----------------------------- | ------------------------------ | -------------------------------- | ---- |
| **recorded (2026-09-03)**     | `[240, 86]`                    | `[715, 280]`, `[715, 406]`       | 126  |
| `origin/main` today           | `[249.9, 82]`                  | `[715, 302]`, `[715, 454]`       | 152  |
| `restack/886` (PR #886)       | `[249.9, 94]`                  | `[715, 302]`, `[715, 466]`       | 164  |
| `restack/887` (PR #887)       | `[249.9, 236]`                 | `[715, 302]`, `[715, 608]`       | 306  |

Readings:

- **`main` alone already fixes the KSampler collision.** The `280 → 302` shift is the
  title-aware rect from #882/#883, already merged. It does *not* come from #886/#887.
- **#887 is the load-bearing one for the CLIPTextEncode pair.** It is the change that
  charges the multiline `text` widget its measured 166px instead of a 20px widget row.
  It moves `dy` from 164 to 306 and the recorded `size` from 86 to 236 — i.e. after a
  re-record the nodes are both further apart *and* recorded as taller, which is what
  makes the CLI's model agree with what LiteGraph draws.
- All three revisions probably clear the 132px rendered height on arithmetic alone.
  Only the browser decides. That is the whole point of this spec, so do not pre-declare
  a pass from the table above.

### Two dependency facts that gate the flip

1. **#886/#887 are a four-deep stack, all still open.**
   `887 → 886 → 885 (feat/layout-quality-scorer) → 884 (test/litegraph-constant-parity) → main`.
   "Once #887 merges" means 884, 885 and 886 merge first.
2. **`Comfy-Org/cloud` pins a comfy-cli that predates all of it.**
   `services/agent/Dockerfile` and `services/agent/cli-runner.Dockerfile` both pin
   `comfy-cli.git@9477e16df5a71537e4fb77a6d68c068329485400`, which is **76 commits
   behind `comfy-cli` main and does not even contain #882/#883**.
   `.github/workflows/agent-cli-contract.yml` gates the two Dockerfiles against each
   other, so both bump together.

   This matters: a fixture recorded against a locally-built #887 comfy-cli would assert
   a layout that **production does not ship**. The green regression test would be
   truthful about the CLI and false about the product. The real gate on flipping
   `test.fail()` is therefore *the cloud pin bump*, not #887 merging.

---

## 3. The exact re-record procedure

Sources: `browser_tests/fixtures/data/agent/README.md`,
`docs/testing/agent-integration-development.md`, `scripts/dev-agent-record-mode.ts`,
`scripts/agentConversationRecord.ts`.

### Prerequisites (all of them; the recorder refuses to start without the env five)

- A `Comfy-Org/cloud` checkout with its own local stack up (`cloud up`), publishing
  **Postgres on 54331** and **Redis on 6379** in Docker containers. `dev-agent-record-mode.ts`
  TCP-probes both and then resolves `docker exec` forms for `psql`/`redis-cli` itself,
  refusing if zero or more than one container publishes the port.
- A **ComfyUI backend on 8188**.
- The **`temporal` CLI** on PATH (`--engine temporal`, needed so a turn can be cancelled;
  the launcher starts `temporal server start-dev` itself).
- **`ANTHROPIC_API_KEY`** — this is a live LLM turn against a real model.
- **`COMFY_BIN`** pointing at a comfy-cli that works with `HOME` overridden (the agent
  sandboxes its tool calls). This is the lever that selects the placer: cloud reads it at
  `services/agent/config/config.go:39` (`envconfig:"COMFY_BIN" default:"comfy"`), and
  `recordEnv()` in `dev-agent-record-mode.ts` spreads `process.env` into the agent
  process, so whatever you export at the launcher is what computes `pos`.
- Node per the repo's `engines`, plus the standing workspace gotcha:
  `NODE_OPTIONS="--no-experimental-webstorage"` for any vitest, and `nvm use 25`.

### Step 1 — bring the recording stack up

```bash
AGENT_MODEL=claude-opus-5 \
COMFY_BIN=<path to the comfy-cli under test> \
pnpm exec tsx scripts/dev-agent-integration.ts --record \
  --engine temporal \
  --catalog browser_tests/fixtures/data/agent/conversations/agent-rec-batched-ops.json \
  --cloud-repo ../cloud \
  --agent-port 8087 --doc-host-port 8096 --temporal-port 7234
```

It seeds a fixed identity (`rec-local-user` / `w-1f2e3d4c-…`), writes a fresh M2M secret
and the widget catalog extracted from `--catalog`, starts the doc host and the agent with
`AGENT_CRDT_MODE=on` + `AGENT_TARGET=local`, then **prints the recorder command with every
value filled in**. Use the printed one; do not hand-assemble it.

### Step 2 — record the turn

Paste the printed command, filling in the case id, the seed fixture and the prompt. The
prompt must be the recorded one verbatim, because it is what forces the single batched
`apply_ops` this case exists to exercise:

```bash
AGENT_CLOUD_SHA=<printed> AGENT_MODEL=claude-opus-5 \
AGENT_M2M_SECRET_FILE=<printed> AGENT_FULLSTACK_URL=http://127.0.0.1:8087 \
AGENT_WORKSPACE_ID=<printed> AGENT_USER_ID=<printed> \
AGENT_PG_EXEC="<printed docker exec …>" AGENT_REDIS_EXEC="<printed docker exec …>" \
pnpm exec tsx scripts/agentConversationRecord.ts \
  agent-rec-batched-ops \
  browser_tests/fixtures/data/agent/conversations/agent-rec-batched-ops.json \
  --prompt "Switch to the tab 'Text to image', then in ONE apply_ops call add two CLIPTextEncode nodes and wire both of their CLIP inputs from the checkpoint loader. Use a single batched tool call for all four operations." \
  --out browser_tests/fixtures/data/agent/conversations/agent-rec-batched-ops.json
```

Notes:

- The **second positional argument can be the fixture itself**. `zSeedFixture` only reads
  `.workflow`, so re-seeding from `agent-rec-batched-ops.json` reproduces the identical
  seed graph and catalog and keeps the diff to the recorded turn.
- The first prompt **must** switch tabs: the replay subscribes to the document only on an
  `agent_active_tab` frame.
- Sidecars land in `conversations/recordings/` (raw frames, per-turn Postgres row dumps,
  a receipt with hashes). Those are **not committed** — the directory does not exist in
  git today, and nothing in the FE validates the `raw capture sha256` string that ends up
  in `source.note`.
- A refused recording names its gate and appends to `recordings/<case>.refused.jsonl`;
  re-record with a new `AGENT_ATTEMPT`.

### Step 3 — replay and verify

```bash
# terminal A
DISTRIBUTION=cloud DEV_SERVER_COMFYUI_URL=http://127.0.0.1:8188 pnpm dev

# terminal B — conversation replay (fixture still valid)
pnpm comfy-test agent-replay --case agent-rec-batched-ops

# terminal B — the layout spec, which agent-replay cannot reach
PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=http://localhost:5173 DISTRIBUTION=cloud \
  pnpm exec playwright test browser_tests/tests/agent/agentLayoutQuality.spec.ts --project=cloud
```

**Harness gap worth an upstream fix:** `agentReplayInvocation` hard-codes
`playwright test agentConversation --project=cloud` and a `-g "recorded <case>"` filter
(`tools/test-recorder/src/commands/agentReplay.ts:48-71`), so `comfy-test agent-replay`
structurally cannot run `agentLayoutQuality.spec.ts`. Per CLAUDE.md rule 3 (harness
friction is product work) that is a small recorder PR, not a reason to invoke playwright
by hand forever.

Expected signal: the run reports **"Expected to fail, but passed"** for the batched
overlap case. Only then remove `test.fail()` and its comment block.

---

## 4. Could the `pos` values be regenerated instead of re-recorded?

Mechanically, yes, and cleanly. `comfy_cli/layout.py` is documented as
*"Pure: same inputs → same output… no randomness, no clock, no I/O"*, and
`assign_positions` takes exactly `(workflow, graph, specs)`. The fixture carries the
`workflow.seed` and the ops. The only external input is `graph` (the `object_info`
catalog), and `comfy workflow apply` accepts it from a file via `--input-path`, so no
backend is needed. I regenerated the table in §2 this way in about a minute.

**It should nonetheless not be done here.** Reasons, in order of weight:

1. **The repo forbids it in three places, in the imperative.**
   `browser_tests/fixtures/data/agent/README.md`: *"Do not write `graph_ops` by hand or
   relabel a synthesized response"* and *"Re-record with a new `AGENT_ATTEMPT` rather than
   editing a capture by hand."* `browser_tests/README.md:757`: *"Never write `graph_ops`
   by hand and never relabel a synthesized response as recorded."* Program CLAUDE.md
   harness-first rule 3 forbids hand-editing recordings to make tests pass. Splicing new
   `pos`/`size` into a committed `graph_ops` block is writing `graph_ops` by hand,
   whatever tool produced the numbers.
2. **It silently converts `recorded` into `synthesized` while the label still says
   `recorded`.** `source.note` would still name thread `a6fd73be…`, the three
   `agent_tool_calls` parent row ids and `raw capture sha256 9275…`, none of which would
   describe the file any more. Nothing in the tree checks that — `zAgentConversation`
   validates structure and `assertOpsApply` replays the ops, but no hash gate exists — so
   the falsehood would be undetectable by CI and would sit in the tree indefinitely. An
   unfalsifiable provenance claim is worse than a red test.
3. **It would prove the wrong thing.** The spec exists because the CLI's *model* of
   LiteGraph disagreed with the *renderer*. If we compute positions with the fixed model
   and then assert the browser agrees, we have tested that the new model is
   self-consistent with a graph built under the new model — the seam the test was written
   to watch is the CLI↔browser one, and a regeneration keeps the CLI on both sides of it.
   A real recording also exercises the agent → cloud → comfy-cli → audit-row → wire path,
   which is where an integration regression (e.g. cloud not passing `--input-path`, or a
   pin that never got bumped) would actually show up.
4. **A faithful regeneration is not cheap anyway.** Node and link ids are randomly minted
   (`mint_id()`), so a real `workflow apply` run produces different ids and you would be
   back to splicing only the `pos`/`size` subfields — i.e. the most obviously hand-edited
   possible outcome. And `workflow_ops.add_node` on `restack/887` still does **not** pass
   `n_multiline` to `estimate_size` (only `layout.assign_positions` does), so the
   regenerated `node.size` and the regenerated `pos` disagree with each other unless you
   reproduce that asymmetry exactly — which means faithfully reimplementing a bug.

**Legitimate uses of the regeneration script**, which I would keep:

- Pre-flighting, exactly as in §2: knowing before you book a recording session whether the
  merged stack actually moves the numbers far enough.
- A cheap CI canary in `comfy-cli` that replays this fixture's seed through
  `assign_positions` and asserts the stride exceeds the measured render height — a unit
  test, clearly labelled as such, which is *not* a substitute for the browser assertion.

Finding #4 above is worth reporting upstream on its own: **#887 fixes the batched path
and leaves the single-`add_node` path under-measuring multiline nodes.** The sequential
control case in the spec passes today only because cascade placement spaces nodes
generously, not because `add_node` measures them correctly.

---

## 5. Recommendation — fastest safe path once #887 merges

1. **Do not flip anything on #887 alone.** Wait for the whole stack (884, 885, 886, 887)
   and then for the `Comfy-Org/cloud` pin bump in both
   `services/agent/Dockerfile` and `services/agent/cli-runner.Dockerfile`. File/track that
   bump now — it is the long pole and it is nobody's current task. (76 commits of drift
   suggests the pin is bumped rarely and by hand; a scheduled bump-PR would be the IaC
   answer.)
2. **Pre-flight before booking a session.** Re-run the §2 harness against the merged
   `comfy-cli` SHA that cloud will pin. If the stride does not clear the ~132 graph px the
   browser measured, the recording session is wasted; fix the CLI first.
3. **Record once, against `COMFY_BIN` = the pinned SHA**, not a local branch build. Use
   §3 verbatim. Re-record only `agent-rec-batched-ops`; leave every other fixture alone —
   they are not evidence for this assertion and re-recording them is unnecessary churn and
   unnecessary token spend on live LLM turns.
4. **Also re-run the sequential control** (`agent-rec-three-sequential-adds`) unchanged.
   The spec says explicitly that if the control fails while the batched case passes, both
   results are suspect. Do not re-record the control — its value is that it is untouched.
5. **Flip the marker only on a green browser run**, and in the same commit delete the
   `test.fail()` block and its comment, update `source.note`'s cloud SHA (the recorder
   writes it), and state the new `dy` and the measured clearance in the commit message so
   the next person can tell whether a future regression is spacing or rendering.
6. **Open the small recorder PR** so `comfy-test agent-replay` can target the layout spec
   (§3), rather than leaving a hand-typed playwright invocation as the documented path.

**Fallback if the cloud pin bump stalls.** Do not regenerate the fixture to get green.
Keep `test.fail()` — it is doing its job, and it is honest: production still ships the old
placer. If a green signal is needed sooner, add a *separate* comfy-cli-side unit canary
(§4) and leave the browser assertion red until the product actually changes.

---

## Appendix — environment hazards hit during this investigation

- `/home/c_byrne/repos/comfy-cli` is a **shared checkout and another lane flips its
  branch mid-session** — it moved from `restack/887` to `restack/886` between two of my
  commands. Read comfy-cli through `git show <ref>:<path>` rather than the working tree,
  or use a dedicated worktree.
- `browser_tests/fixtures/data/agent/conversations/recordings/` does not exist in git;
  the recorder creates it locally. Nothing validates the `raw capture sha256` recorded in
  `source.note` against the fixture, which is what makes §4.2 undetectable.
