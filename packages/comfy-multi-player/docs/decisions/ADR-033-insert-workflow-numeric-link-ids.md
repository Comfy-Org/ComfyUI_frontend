# ADR-033: numeric link ids for `insert_workflow`

- **Status:** Amended and accepted — see "Amendment (2026-09-23)" below. The original decision (2026-09-22, below) shipped a document-state-verified retry mint; Christian Byrne's review of that revision (PR #245) found it broke link identity's order-independence and asked for either a fix plus explicit sign-off on the residual risk, or a return to pure derivation. This amendment takes the pure-derivation path and was ratified after exact-head review of that fix and its opposite-order convergence coverage. **The "Accepted" disposition below describes the ORIGINAL decision only** and is superseded by this accepted amendment.
- **Date:** 2026-09-22 (original), amended 2026-09-23
- **Decider:** Christian Byrne
- **Source:** ComfyUI_frontend#18458 (interim 32-bit-hash review) and the Slack thread it was raised in; the amendment's source is Christian Byrne's PR #245 review (inline comment on `src/remap.ts:65`, review summary "Not merge-ready: link identity becomes arrival-order-dependent").

## Context

ADR-031 remaps every id `insert_workflow` carries — node, link, group, and
nested-definition id — to a deterministic **string** derived from the op
envelope id, graph scope, id kind, and original id
(`insert:<opId>:<scope>:link:<original>`). That is a correct fit for a
`NodeId` (`string | number` on the frontend) but not for a `LinkId`, which
ComfyUI_frontend brands as `number & { __brand: 'LinkId' }`. The frontend's
interim fix (`ecsFollowerAdapter.ts`'s `resolveLinkId`) hashed the derived
string into a number with FNV-1a folded into a 32-bit space. Two independent
reviewers (Christian Byrne, dante01yoon) found this genuinely broken, not
merely approximate:

- The 32-bit hash space is small enough that two distinct derived ids collide
  at a measured, reproducible rate (~0.01% at 1k live derived links, ~1% at
  10k, birthday-bound), silently replacing one link with another with no
  error reported — indistinguishable from the original "links silently
  dropped" bug this was fixing.
- The resolved numeric id is what `graph.serialize()` writes to the saved
  workflow file. A reserved id range chosen to sit above any real
  `last_link_id` does not survive a save/reload: the persisted file now
  contains a genuine numeric link id inside that "reserved" range, and
  nothing bounds real link ids below it, so a LATER `insert_workflow` can
  collide with a real, previously-synthetic-now-real id. A session-local
  allocator has the same reload hole from the opposite direction: a fresh
  session's reservation map is empty and does not know the reloaded id is
  taken.

Both reviewers converged on the same root fix: mint the numeric identity
where the link is minted (this package), not on every frontend peer that
happens to read it.

## Decision

`remap.ts`'s `derivedLinkId` mints a real JS `number` for every link id
`insert_workflow` derives — at the top-level graph scope AND at every
subgraph-definition interior scope, so the fix does not regress
comfy-multi-player#230's `remapLinkIdArray`/definition-interior handling.
Every other kind `insert_workflow` derives (node, group, definition) is
UNCHANGED: still the ADR-031 string, still a pure function of
(`opId`, `scope`, `kind`, `original`) with no document-state dependency.

The link-id mint is NOT a wider hash gambled to be "unlikely enough" — the
same failure mode being fixed. It is:

1. **Hashed**: SHA-256 of the same `insert:<opId>:<scope>:link:<original>`
   seed ADR-031 already uses, keeping 52 bits (well inside
   `Number.MAX_SAFE_INTEGER`) as the first candidate.
2. **Verified against every id the caller can see**, not assumed collision-free
   by width alone: the caller (`applier.ts`) passes `derivedLinkId` (via
   `remapInsertedWorkflowIds`'s `reservedLinkIds` parameter) every numeric
   link id already persisted in the target document — top-level AND every
   subgraph definition's interior links, at every nesting depth
   (`doc.ts`'s `persistedLinkIds`) — plus every id `derivedLinkId` has already
   minted earlier in the SAME `insert_workflow` call, so two links in one
   insertion can never collide with each other either.
3. **Retried, bounded**: on a collision the mint deterministically tries the
   next candidate (re-hashing with an incremented attempt counter) up to
   `MAX_LINK_ID_MINT_ATTEMPTS` (256) times. Any realistic document — even one
   with millions of live links — succeeds on the first or second attempt;
   the bound exists so a pathological/adversarial reservation set fails
   loudly (`link_id_collision`, byte-identical, `op_id` not consumed) in
   bounded work rather than looping.

This directly fixes the reviewers' reproduction: two independent
`insert_workflow` ops (distinct `op_id`s) inserting links that would
otherwise hash to the same value now resolve to distinct ids, because the
second op's mint sees the first op's already-committed numeric id in
`persistedLinkIds` and retries past it — the exact cross-op collision the
32-bit interim hash reproduced.

## Deviation from KA-5 / ADR-031

Every other id `insert_workflow` derives is intentionally **pure**: a
function of the op's own fields alone, with producers/the applier never
inspecting document state to decide an id (KA-5's "IDs are collision-free
without coordination" and ADR-031's "Producers do not inspect document
state or remap ids"). `derivedLinkId` breaks that purity for links, and only
for links: a truly information-theoretic collision-free encoding of an
unbounded set of possible (`opId`, link) pairs into a fixed 53-bit numeric
space is impossible by construction (pigeonhole), unlike the string form,
whose output space is unbounded and therefore never needs to consult
anything besides the op itself. Squeezing that identity into a small,
externally-imposed numeric type (`LinkId`) is only possible by ALSO checking
it against real state — so this package does, rather than pretending a wide
hash is "collision-free" the way the interim frontend fix did. This is
logged as a deliberate exception in `docs/decisions/EXCEPTIONS.md` (KA-5 row),
with the residual gap named explicitly: two REPLICAS that have never
exchanged this op and each independently mint a colliding candidate from
their own (different) locally-visible document state could in principle
diverge — bounded by the same ~2^-52-per-pair probability that makes a UUID4
`op_id` collision (already a foundational assumption throughout this
package, KA-2) an accepted risk elsewhere in this same system.

## Consequences

- ComfyUI_frontend can delete its `resolveLinkId`/`fnv1a` hashing entirely
  (tracked in ComfyUI_frontend#18458) and read `LinkId` straight off the doc.
- `link_id_collision`'s existing insert-time collision check
  (`applier.ts`'s `acceptsLink`) is no longer reachable via any
  realistically-shaped input for LINKS specifically, because the mint now
  actively avoids everything that check would have caught. It remains
  reachable, and is retained, via the id-space-exhaustion path above; the
  test suite covers exhaustion directly rather than asserting an
  unreachable natural collision.
- `updateInsertedWorkflowMeta`'s `last_link_id` high-water-mark bookkeeping
  deliberately does NOT fold in these new large numeric ids (see the comment
  at its call site) — they are not meant to look like the next sequential
  id, and KA-5 already treats this field as advisory only.
- `SCHEMA_VERSION` is unchanged: no document root or reserved key changes,
  only the VALUES `insert_workflow` was already free to choose for a link id.

## Amendment (2026-09-23): pure derivation, no document-state retry

**This amendment supersedes the "Decision" and "Deviation from KA-5 / ADR-031"
sections above for the CURRENT behavior.** They are kept as written for
history — they are what actually shipped in the original PR #245 revision —
but `derivedLinkId` no longer works the way they describe.

### What review found

Christian Byrne's inline blocker on `src/remap.ts:65`:

> Blocker: `taken` makes identity depend on local arrival order. If two link
> seeds share the first candidate, A→B yields A=x/B=y while B→A yields
> B=x/A=y, so replicas applying the same op set can project different link
> IDs. Please add an opposite-order convergence case and obtain explicit
> owner ratification for the collision-free ID invariant (KA-5) exception,
> or retain pure derivation.

This is exactly right, and it is a sharper failure than the interim frontend
hash this ADR originally set out to fix: the retry-against-`taken` design
made the FINAL numeric id a function of arrival order whenever two link
seeds' natural (zeroth) candidates coincided, which the original "Decision"
section's item 2 ("verified against every id the caller can see") describes
as a feature rather than naming as this cost.

### The amended decision

`derivedLinkId` (`src/remap.ts`) mints PURELY from the op's own content —
`opId`, `scope`, and the raw link's original id/tuple — with **no document
read, no caller-supplied reservation set, and no retry**. `remapInsertedWorkflowIds`
no longer accepts a `reservedLinkIds` parameter; `applier.ts`'s
`prepareInsertedWorkflow` no longer calls `doc.ts`'s (now-deleted)
`persistedLinkIds`. The same `(wf, opId)` pair always produces byte-identical
output — including every link's numeric id — on any replica, in any
document state, regardless of what other ops have or have not been applied
yet, at the top-level scope AND at every subgraph-definition interior scope.
This restores ADR-031's "producers do not inspect document state or remap
ids" for links, closing the gap this ADR's original "Deviation" section
opened.

The mint also widens its candidate from 52 to the FULL safe-integer range:
it hashes the ADR-031 seed with SHA-256, takes 32 hex characters (128 bits,
comfortably enough to keep the reduction below close to uniform), and folds
that down via `% (Number.MAX_SAFE_INTEGER)` into `[1, Number.MAX_SAFE_INTEGER]`
— `[1, 2^53 - 1]`, all of it, rather than the narrower `2^52` window the
original revision used. `Number.isSafeInteger` (used elsewhere in this
package, e.g. `doc.ts`'s deleted `persistedLinkIds` and `applier.ts`'s
`numericId`) accepts exactly this range, and it round-trips losslessly
through `JSON.stringify`/`JSON.parse` and Yjs storage, which is what a
saved-and-reloaded workflow file and a `Y.Map` value both need.

### Residual collision probability

With `N = 2^53 - 1 = 9,007,199,254,740,991` possible candidates and
(to first order, since the modulus reduction is close to uniform) two
INDEPENDENTLY derived candidates, the probability that a specific pair
collides is `1/N ≈ 1.11 × 10⁻¹⁶`. For `k` derived link ids all drawn from
this space, the birthday-bound probability that ANY two collide is
approximately `k² / (2N)`. At `k = 200` (this package's own scale test) that
is about `2.2 × 10⁻¹²`; at `k = 1,000,000` (unrealistically many links in one
document) it is about `5.5 × 10⁻⁵` — still far below anything a real
workflow reaches. This is the same order of magnitude this package already
accepts for a UUID4 `op_id` collision (KA-2, 122 bits of entropy per id,
so an equivalent `k²/(2N)` bound at real-world `k` is smaller still, but
both are "cosmically unlikely, not impossible" risks this package already
lives with elsewhere).

A REALIZED collision — a freshly derived link id that equals one already
persisted in the target document, or one already derived earlier in the
SAME `insert_workflow` call — is not specially detected or avoided by the
mint (that would reintroduce the document read this amendment removes). It
is caught, if and when it happens, by the ordinary apply-time id-collision
handling every other `insert_workflow` id kind already goes through
(`applier.ts`'s `acceptsLink`, and the `seenLinks` intra-op duplicate check
ahead of it) — the whole op is rejected `link_id_collision`, byte-identically
and without consuming the `op_id` (KA-4), rather than the op silently
picking a different id for the colliding link. This trades a vanishingly
small chance of a LOUD, safe rejection for the arrival-order-dependent
SILENT divergence the retry design risked — the right trade, since a loud
failure that never fires in practice is strictly better than a silent one
that can.

### Cross-mechanism interaction with `connect` (a separate, pre-existing risk)

A `connect` op's client-minted `link_id` can, in principle, coincide with a
numeric id `insert_workflow` derives for an unrelated link — a SEPARATE risk
from the one this amendment addresses, raised independently in the Slack
thread linked above. `applier.ts`'s `claimLinkIdentity` (the `connect`
register) does not check for this at all: it deletes and replaces whatever
currently occupies that numeric key with no LWW gate when no prior
`("link", …)`-register stamp exists for it, which is always true for a key
an `insert_workflow` link occupies (that link's stamp lives under a
DIFFERENT register, `("insert_workflow_link", key)`). This asymmetry
predates this ADR and this amendment equally: the ORIGINAL document-verified
retry mint only ever avoided this collision in the one arrival order where
the `connect` had already landed before the `insert_workflow` mint ran on
that replica (in which case `persistedLinkIds` saw it and the retry skipped
past it, applying `insert_workflow` cleanly with a different id); in the
opposite order (`insert_workflow` lands first, `connect` arrives later) the
retry design offered no protection at all, because it cannot see a future
op's client-chosen id — `claimLinkIdentity` would silently overwrite the
`insert_workflow` link exactly as it does today. That is itself a real,
order-dependent divergence between replicas that was already present before
this amendment.

The amendment does not fix this — it is explicitly out of scope for this PR,
and fixing it would mean changing `claimLinkIdentity` to recognize an
`insert_workflow`-sourced incumbent, not anything in `remap.ts`. What the
amendment changes is narrower: removing the retry removes the one arrival
order (`connect`-then-`insert_workflow`) where the OLD design offered
partial, order-dependent protection, so that order now also rejects loudly
(`link_id_collision`) rather than silently succeeding with a different id.
The genuinely dangerous order (`insert_workflow`-then-`connect`, silent
overwrite) is unaffected by this amendment either way, and both orders
require an engineered or astronomically unlucky collision between a
client-chosen `link_id` and a 53-bit hash output to occur at all. This is
recorded here, honestly, as a known, unresolved, pre-existing gap — not
claimed as fixed and not newly introduced by this amendment.

### Consequences of the amendment

- The "Consequences" section's `acceptsLink`/`link_id_collision`-reachability
  bullet above is corrected: that check IS reachable via realistic input
  now (any real collision reaches it, since nothing avoids one), not merely
  via deliberate id-space exhaustion — there is no more exhaustion to
  construct, because there is no more retry sequence.
- `test/insert-workflow.test.ts`'s "numeric link id minting (ADR-033, pure
  derivation)" block and
  `test/insert-workflow-numeric-link-ids.regression.test.ts`'s
  "opposite-order convergence" block replace the retry/exhaustion-focused
  tests the original revision added, per Christian's request for an
  opposite-order convergence case.
- The **Glossary**'s "Reservation set" entry below no longer applies to the
  shipped mint; it is kept as history since the "Decision" section above
  still uses the term.

## Glossary

- **Derived id:** ADR-031's deterministic string, `insert:<opId>:<scope>:<kind>:<original>`.
- **Candidate:** the single hashed numeric value `derivedLinkId` computes for one link (post-amendment: there is exactly one, never retried).
- **Reservation set (historical, pre-amendment only):** the ids the original retry-based mint call was required not to choose — persisted document ids plus ids already minted in the same call. Not part of the amended design.
