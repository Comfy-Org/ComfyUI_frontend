# API contract — proposal for review

**Read this before the meeting. Disagree with specific sentences.**

Two halves:

- **Part 1 — decisions to ratify.** Already implemented and tested. Rejecting
  one means changing code, so each states the measurement that forced it.
- **Part 2 — open questions.** Not settled. This is what the meeting is for.
  Each has a recommendation and the trade-off it costs.

Grounded against the source at `6793d75`, `docs/multiplayer-schema.md`, and the
op vocabulary in comfy-cli. Nothing on a default branch consumes this package
yet — the server doc host lives on an unmerged branch — so a contract change is
still cheap. That will not stay true.

---

## Part 1 — decisions to ratify

### D1. Widgets are addressed by name, not by position

**Proposal.** A node's widget values live in a map keyed by widget name. The
positional `widgets_values` array exists only in the projection, assembled from
the catalog's widget order.

**Why.** Two writers editing the **same index** of a KSampler's 7-element
`widgets_values`, exchanged as Yjs structures, merge into a **length-8** array.
Both inserts survive and every widget after the contested index shifts by one:
`cfg` reads the steps value, `sampler_name` reads `8`. The corruption is silent
and total for that node, and same-index concurrency is exactly the case the op
model has to support. Different-index concurrency was safe; that is not enough.

**Cost, accepted.** The document is no longer self-contained. Projecting needs
the catalog, and so does applying an `add_node` that carries positional widget
values. That dependency is why `meta.catalog_version` exists (D7).

### D2. Node identity compares as a string

**Proposal.** `7` and `"7"` are the same node, everywhere — including in the
key that identifies which write conflicts with which.

**Why.** Both types are legal traffic: historical workflows carry string ids
and subgraph addresses are strings like `"57:3"`. Conflict keys were built from
the raw value while node lookups resolved through `String(id)`, so one node had
two conflict registers, the gate never compared them, and the pair converged by
arrival order. The Python half had the matching bug in the other direction: an
exact `==` meant a string-typed op silently did nothing — an accepted write
that never happened.

**Cost.** A document mid-flight across the upgrade loses prior claims on
numerically-keyed targets and falls back to first-writer-wins there until the
next write. Not a data migration; conflict bookkeeping lives only inside a live
document.

### D3. `op_id` is the idempotency key, and "applied" is not "your value won"

**Proposal.** The creator mints `op_id` before dispatch and never regenerates
it — not on retry, not on redelivery. A document applies each `op_id` exactly
once. Re-delivered ops come back in `skipped`.

Three outcomes report as **applied**: the write landed, the write was dropped
by last-writer-wins, or the target node was already deleted. All three consume
the `op_id`; only the first changes the document.

**Qualified by schema Amendment A6 (2026-08-21), the same qualifier D5 carries.**
The deleted-target outcome is `applied` only for an op that is WELL FORMED ON ITS
FACE. Every `connect` precondition that depends on the op alone — the
`from_slot`/`to_slot` numeric domain, the `grow` payload shape, the
`grow.inputcount.widget` type, and the cloneability of a widget value — is
evaluated before the delete-wins return, so a malformed op naming a deleted node
is `failed` and consumes nothing. Otherwise whether an op was rejected would
depend on which replica had seen the delete first, and under §4 abort-remainder
the two would then disagree about the rest of the batch.

**Why.** `op_id` is also the final tiebreak in conflict resolution, so
regenerating one on retry changes who wins, not just whether the op is
deduplicated. And a client that treats `applied` as "my value is now in the
document" will render a value the document does not hold — clear a pending op
when its effect arrives on the update stream, not when the ack lists it.

### D4. Batches abort the remainder; a rejected op consumes nothing

**Proposal.** If op *k* in a batch fails, ops before it stay applied and ops
from *k* onward are not applied at all. The failure is returned, not thrown:
`{index, op, code, message}`. A rejected op leaves the document byte-identical
and does not consume its `op_id`, so fixing the failing op and resending the
whole batch is always safe — the prefix returns in `skipped`.

**Status: qualified, and narrower than it was (2026-08-21, #34).** The `op_id`
half holds everywhere. The byte-identity half is swept per rejection code by
`test/ka4-rejection-byte-identity.test.ts` (#58), which recorded four `connect`
rejections that validated *after* their first write — one of them severing an
incumbent link. **All four now hold**, and #34 additionally makes every op-only
`connect`/`set_widget` precondition run before the delete-wins returns, so those
rejections are order-independent too (schema Amendment A6).

Amendment A9 closes the cloneable-but-unstorable, `connect.link_id`, and
`delete_node.removed_links` write-order paths. Amendment A10 closes reference
cycles. Amendment A14 shape-validates `connect.link_type` before any write
without imposing catalogue membership validation.

**Why.** The alternative, rejecting the whole batch, throws away work the
writer already considers accepted. The alternative to *that*, skipping the
failing op and continuing, applies later ops that assumed the earlier one
landed.

### D5. A concrete input is a last-writer-wins register; autogrow is not

**Proposal.** A concrete input holds at most one link, so "who occupies this
slot" is a scalar target resolved by the same stamp comparison as a widget
write. The winner retires the displaced link whole — the link tuple and the old
source's out-link entry both go. The loser writes nothing at all. A winning
connect whose source was concurrently deleted leaves the input empty.

**Amended by schema Amendment A6 (2026-08-21).** The register claim no longer
happens before *all* source resolution: `from_slot`'s op-only domain (a
non-negative integer) is checked unconditionally ahead of the claim, and for a
source that still exists its slot record is resolved ahead of the claim too, so
that a rejected op leaves the document byte-identical (issue #10). What survives
unchanged is the part this clause existed to guarantee — an ABSENT source is
still a delete-wins no-op that claims the register and empties the input, and
the incumbent's survival still does not depend on delete arrival for any op-only
malformation. The one case that does depend on it — an in-domain but
out-of-range `from_slot` racing its source's deletion — is carved out
explicitly in schema §2.5 item 4.

Autogrow connects are deliberately **not** gated: each grows its own slot keyed
by the link id, so two concurrent grows both survive.

**Why.** Without the gate, the occupant of an input was decided by arrival
order, which composed with delete-wins to produce graphs where a link exists in
one interleaving and not in the other. Keeping the register claim independent of
whether the SOURCE resolved is what stops the incumbent's survival from
depending on when a delete arrived — which is why Amendment A6 hoists only the
op-only half of `from_slot` validation above the claim and leaves the
state-dependent half carved out rather than silently order-sensitive. Gating autogrow would silently discard one of two writers'
connections — which is the opposite of the property we want.

**Found by adversarial testing, not by review.** The interleaving suite drove
every order-preserving interleaving of two writers' sequences through the real
applier and caught the convergence claim being false.

### D6. Opaque widgets for classes the catalog cannot describe

**Proposal.** When a class has no widget order in the catalog **at all**, its
`widgets_values` is stored whole under one reserved key and projected back
verbatim. A `set_widget` against such a node is **rejected** with
`opaque_widgets`.

**Why.** `Note` and `MarkdownNote` are rendered by the frontend and never
appear in `object_info`, so no catalog derived from it can ever describe them.
D1's decomposition threw at mint, which meant **any workflow containing a
sticky note failed to mint** — most official templates contain one. Downstream
the failure surfaced as a lie: the CLI had already written its scratch file, so
`ls_nodes` and `validate` reported a healthy graph while the document was
empty.

**Why this is compatible with D1 rather than a reversal of it.** D1 bans
element-wise merging of a positional array — the failure needs the array to be
a mergeable sequence with per-element identity. An opaque value is one plain
value under one key. It is never merged element-wise; concurrent writes resolve
as whole-value last-writer-wins, which is the right semantics for a sticky note
(one of the two texts, not an interleaving of both).

**Cost, accepted.** Name addressing is given up for those nodes. The rejection
is loud on purpose: silently no-oping is the exact failure this change exists
to kill, and writing anyway would create a name-keyed map beside the opaque key
and make **every** later projection of the document throw.

**Rejected alternative.** Adding `Note: {widget_order: ["text"]}` to the
catalog export. It is a hand-maintained list tracking a frontend the catalog
pipeline does not read, and the next frontend-only node breaks production
identically and just as silently.

### D7. The catalog version is pinned at mint

**Proposal.** A document records the catalog identity it was minted against,
and projections are computed against that catalog.

**Why.** A document minted under one catalog and projected under another
silently permutes widget values — the same name-keyed map resolves to different
positions, so a renumbered class renders `cfg` as the steps value. Nothing
about the document looks wrong.

**Ratify the intent, but see Q4: the pin is recorded and not enforced.**

---

## Part 2 — open questions

### Q1. Writer topology — the real disagreement

Three positions are on the table:

| Position | Who holds the document | Who applies ops |
|---|---|---|
| Schema doc, v1 | server doc host | host only; browsers are followers |
| FE action plan | browser client | client only; the agent proposes and the client writes |
| This proposal | server doc host | host only; the agent is a **headless peer**, not a proposer |

The difference between rows 1 and 3 is small; the difference from row 2 is not.

**Recommendation: the agent must be a headless peer.** An agent turn has to run
with **no browser attached at all** — no tab open, session closed, laptop shut.
Under client-sole-writer, an agent turn either stalls waiting for a writer or
its edits live somewhere that is not the document until a client reconnects and
adopts them. That reintroduces exactly the divergence this package exists to
remove, on the path we most need to be reliable.

**What that costs the frontend, stated plainly.** It gives up being the merge
authority. The client renders from a follower document and accepts effects it
did not originate — including its own ops coming back reordered or dropped by
last-writer-wins. Latency hiding becomes a presentation-only overlay rather
than local truth.

**What the package requires either way.** Nothing here mandates a topology.
The one hard constraint is that **ops are the replication unit** and raw Yjs
struct updates are never exchanged between two replicas that applied ops
independently. Struct updates flowing host → follower are fine and keep
followers byte-identical. A future genuinely multi-writer topology is permitted
by the convergence proof, but it converges to projection-equality, not
byte-equality — that is the concrete price of "nobody is the merge authority".

**Decide at the meeting:** where the document lives, and whether an agent turn
may proceed with no client attached.

### Q2. ID allocation must agree across peers

The CLI mints node and link ids as random integers in `[2^40, 2^53)` —
leaderless, collision-free without coordination, always inside
`Number.MAX_SAFE_INTEGER`, always above small frontend counter ids. The
high-water marks in the document are **advisory**, never allocators. Two
`add_node` ops with the same id and different payloads are LWW-gated by
node-presence stamp as of schema Amendment A7; minted ids still avoid the
collision by construction.

The vocabulary marks id representation explicitly open, pending the frontend
stable-ID work.

**Recommendation.** Any peer that mints ids into the shared document uses the
same generator shape (random, ≥ 2^40, < 2^53). If the frontend needs stable ids
of a different shape, they must be strings that cannot collide with that range,
and we must state what happens on collision — today it is silent
first-writer-wins.

**Trade-off.** Random ids are not human-readable or sortable, and they do not
carry frontend-stable identity across a save/reload cycle. Allocating from a
counter would fix both and reintroduce the collision the random range removes.

### Q3. Did the opaque-widgets change need a `SCHEMA_VERSION` bump?

It added a per-node key without bumping, on the argument that the key is
**unreachable in existing documents**: it can only appear on a node whose class
is absent from the catalog, and such a node could not be minted at all before
the change. So there is nothing to migrate.

Forward compatibility holds — a new reader reads old documents unchanged.
Backward compatibility does not: an older reader projecting a newer document
emits the reserved key as an unknown passthrough and drops `widgets_values`
entirely.

**Recommendation: accept the no-bump as a fact** (no live document can contain
the key, and no consumer is pinned in production yet), **and adopt the rule
going forward**: bump when an older reader would mis-project a newer document.
That rule only means something if the code enforces it — today nothing checks
`meta.schema_version` on the read path. `migrate()` fails closed on a newer
document, but nothing calls it before projecting.

**Ask the reviewers:** accept the no-bump, or bump now and treat the version as
the signal an old reader must refuse a new document?

### Q4. The catalog pin is recorded, not enforced — and there is a defect behind it

`mint()` writes `meta.catalog_version` into the document. Nothing ever reads it
back: `project()` and `applyOps()` take a catalog argument and never compare it
to the pin. The catalog type has no version field, so they could not compare it
if they tried. The parameter also defaults to `""`, so a caller that omits it
records nothing at all.

**Recommendation.** Give the catalog a `version` field, have `mint()` record
that field rather than a separate argument, and have `project()`/`applyOps()`
refuse a mismatch. Silent widget permutation is worse than a loud refusal.

**The defect, and it is the more urgent half.** D6 refuses a `set_widget`
against an opaque node so that one bad op cannot poison the document. The
refusal keys on the presence of the opaque value — not on the class being
absent from the catalog. A node of an uncatalogued class that has **no** widget
values at mint (a custom node the catalog export missed, an empty
`widgets_values`) has no opaque value, so the write is accepted, creates a
name-keyed map for a class the catalog cannot describe, and **every subsequent
projection of the whole document throws**:

```ts
const doc = mint({ nodes: [], links: [] }, catalog);
applyOps(doc, [addNode({ id: 1, type: "SomeCustomNode" })], catalog); // applied
applyOps(doc, [setWidget(1, "anything", 5)], catalog);                // applied — no rejection
project(doc, catalog);
// TypeError: type 'SomeCustomNode' has widget values but is not in the pinned catalog
```

Not a hypothetical: any node class missing from the pinned catalog reaches it,
and the document is unrecoverable through the public API afterwards.

**Recommended fix:** reject the write when the node's class is absent from the
catalog, with the same `opaque_widgets` reasoning — the target exists and the
op is unsatisfiable, so reject loudly. Storing it opaquely is not an option: a
name-keyed write has no position to occupy in an opaque array.

**Ask the reviewers:** confirm reject-loudly is the right call before it is
implemented.

### Q5. `reset_doc` has drifted from the normative vocabulary

This package rejects `reset_doc` as deferred, and the README says that is the
vocabulary's status. It is not, any more: the vocabulary un-deferred
`reset_doc`, its deferred list is empty, and the CLI dispatches it. Two
consequences:

1. Our declared payload is **wrong**. We type it as carrying a whole workflow;
   the minted op carries `removed_nodes`, the same as `clear`.
2. `reset_doc` is a **history barrier**, not a bigger `clear`. It drops the
   applied-op bookkeeping, the conflict stamps, and the id high-water marks;
   ops minted against a pre-reset version do not replay across it.

That second point is a genuine open question for a merged document, not a port
task. If the applied-op set is erased, a pre-reset op redelivered afterwards is
no longer a duplicate and applies into the fresh document. In Yjs terms a reset
looks like a new document epoch — followers must resynchronize rather than
merge across it.

**Recommendation.** Keep rejecting `reset_doc` until the epoch semantics are
written down, but reject it with an accurate code and message (it is not
"deferred by the vocabulary" any more — we are declining to implement it), and
fix the declared payload shape now so the type does not teach the wrong
contract.

**Root cause, now fixed.** This repo cited the vocabulary by **branch** — in two
source files and in the schema document, and in the README until this PR. The
vocabulary itself says downstream repos cite it by commit SHA and upgrade by
moving the SHA. Citing a moving branch is how a frozen contract drifts without
anyone noticing, and this is the drift it produced.

The citations are now pinned (FC-10): the vocabulary at comfy-cli
`7e732242d971daf0d2d30f22f997abfacd78986e`, registered in
`docs/upstream-pins.json` and held there by `npm run check:pins`. The branch was
deleted upstream on 2026-08-21 when comfy-cli PR #511 merged, so the citations
this question is about had already stopped resolving.

Pinning makes the size of Q5 exactly measurable, and it is larger than "the
deferred flag is stale". `reset_doc` was un-deferred by vocabulary **amendment
v1.1 (§10)**, which is already present at
`1201b676275ce7e9b5cdb90f135b6e115ba9df10` — the commit this package *already*
cites by SHA for amendment v1.2 in schema Amendment A1. So the package adopted
v1.2 while skipping the older v1.1 in the same document, and the branch pin is
why nobody could see the two citations pointed at different revisions. Upstream
`main` has since added **v1.3 (§12)** and **v1.4 (§13)**; neither is reflected
here. Deciding Q5 therefore means deciding which revision this package tracks,
not just what `DEFERRED_OPS` contains. `docs/upstream-pins.json` records the
observed upstream head and the amendments that post-date each pin, so the
candidate revisions are enumerable rather than a matter of recollection.

### Q6. The carve-outs — accept them explicitly

These are known, tested, and not being fixed here. Confirm we are all fine with
them, or say which one is not acceptable:

1. `outputs[].links` is a set projected as an arrival-ordered array. The set
   converges; a byte comparison of the two orders does not. Closing it means
   canonicalizing a set-valued field in both implementations' projections, and
   it would invalidate recorded fixtures.
2. An autogrow `connect` racing a delete of its source leaves the grown slot
   present in one order and absent in the other. Structural, not a register —
   the same property that makes concurrent autogrows non-clobbering.
3. ~~Two `add_node` ops with the same id and different payloads resolved
   first-writer-wins.~~ Closed by schema Amendment A7's node-presence stamp
   gate. Still reachable from hand-authored or replayed streams. Ties to Q2.
4. Two writes to the same target inside one batch share a `base_version`, so
   they resolve by `op_id`, not by spec order. **"Last spec wins" is not true**
   — it has never been true for widget writes, and now it is not true for
   connects either. This one is most likely to surprise a client author.

---

## Smaller items

- **The purity gate is a denylist**, not the claim we make about it. It fails
  on a list of DOM/framework/litegraph packages; nothing asserts `yjs` is the
  only runtime dependency. If that claim is load-bearing, assert it directly.
- **`mint()`'s third parameter is undocumented in the current README** — one
  symptom of the README not being the contract. This PR rewrites it.

## Decisions

1. **Q1 — writer topology.** The one genuine disagreement. Decide where the
   document lives and whether an agent turn runs with no client attached.
2. **Q2 — id allocation.** Agreement that both peers mint ids the same way.
3. **Q3 — versioning rule.** Accept the no-bump plus a stated rule, or bump.
4. **Q4 — catalog pin.** Approve enforcing the pin and rejecting a widget write
   against an uncatalogued class.
5. **Q5 — `reset_doc`.** Agree to pin the vocabulary by SHA and to fix the type
   now, epoch semantics later.
6. **Q6 — carve-outs.** Explicit acceptance, or name the one that is not
   acceptable.
