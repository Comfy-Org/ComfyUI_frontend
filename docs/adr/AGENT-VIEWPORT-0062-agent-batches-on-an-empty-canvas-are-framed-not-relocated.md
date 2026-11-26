# ADR-AGENT-VIEWPORT-0062: An agent batch on an empty canvas is framed, not relocated

Date: 2026-11-26

## Status

Accepted

## Context

"The agent says it built my workflow and the canvas is empty" has been
reported repeatedly and has had several distinct causes. The delivery causes
are fixed and shipped: a document-schema skew that made the follower refuse a
newer document is released, the refusal now reaches the person as a reload
prompt, and the panel no longer presents a canvas-affecting claim as settled
unless it has observed canvas state. Production turn pairs where the previous
turn left nodes and the next turn opens at zero have run 0.14%–0.52% a day for
the twenty-two days to 2026-11-26, at or below the pre-incident band, against
a 22.4% peak during the skew incident.

One cause survives all of that, and no delivery metric can see it: the batch
reaches the canvas and the user still cannot see it. Reported on 2026-10-20 —
nine template nodes applied to the correct bound tab at y 4850–5930, every
apply successful, canvas visibly empty — and reproducible today.

`ADR-CRDT-PLACEMENT-0035` deliberately exempts an empty canvas from
repositioning so that an agent-inserted template keeps the layout its author
baked in, "matching the human template flow". The exemption is right and the
comparison is incomplete: the human template flow keeps that layout **and
frames it**. `app.ts` calls `fitView()` when `openSource === 'template'`, and
for a saved workflow it restores `extra.ds`. The agent flow kept the layout
and left the camera wherever it was, which on a fresh tab is the origin. So a
template whose own coordinates sit thousands of pixels away was delivered
correctly and invisibly, and the only recovery was the activity banner's
opt-in "View N nodes" button, which a user who believes nothing happened has
no reason to press.

Three candidate remedies existed, each written up but never chosen, which is
why this sat open for six weeks.

## Decision

**The nodes stay where the template put them. The camera moves to them,
once, and only when the user is looking at a canvas that is not empty and
appears to be.**

`shouldFrameAgentBatch` (`src/workbench/extensions/agent/crdt/batchFraming.ts`)
returns true only when all of these hold:

- the batch has a measurable extent;
- **no other node is on the graph** — the batch is the entire canvas;
- the camera's visible area is known; and
- none of the batch intersects that visible area.

`AgentGraphActivityBar` then calls the same `animateToBounds` path the "View
nodes" button already used, keyed by the activity target so one turn's batch
frames at most once however many frames it materializes in.

Everything outside that intersection is unchanged. A batch landing beside
content the user is already looking at does not move the camera:
`ADR-CRDT-PLACEMENT-0035` has already parked it next to that content, and
taking the camera off what someone was working on is a worse defect than the
one being fixed. An unmeasured camera does not frame either — an unknown
viewport is not evidence that the batch is invisible, and a wrong move costs
the user their position.

## Alternatives considered

### Reposition the batch instead: relax `ADR-CRDT-PLACEMENT-0035`'s empty-canvas exemption

Rejected, and not merely because it reverses a ratified decision.

`placementOffset` anchors a moved batch to the hull of the content already on
the canvas. On an empty canvas there is no such hull, so this option cannot be
implemented by dropping the `existing.length === 0` guard — it needs a new
anchor, and the only one available is the viewport. That makes **persisted
node coordinates a function of where the viewer's camera happened to be** when
the frame arrived.

That is the wrong direction across two invariants this project holds. The
applier must be deterministic — the same ops in the same causal order must
produce the same projection — and layout is FE-owned state that view state
(pan, zoom) must not flow into. Today the viewport only ever _vetoes_ a move
whose destination is computed from document state; under this option it would
_determine_ the destination. It also breaks the property the exemption exists
to protect: an agent-inserted template would no longer carry the same layout a
human-loaded one does.

The informal freeze that an earlier write-up gave as a reason to avoid this
area no longer applies — the paths it named were deleted by the graph-API
rewrite — so this option is rejected on its merits, not on process.

### Tell the agent which tab is visible and change its wording

Rejected as a remedy for _this_ defect, though the work itself is largely done
and valuable. The stale-tab and reload-advice wording changes shipped, and the
agent's prompt now ties a canvas claim to whether the edit committed. None of
it puts the nodes on screen: the agent would say something truer about a
canvas the user still cannot see. It also needs a new client→server signal and
has no black-box proof path without eval work, and the measured residual in
this class is users managing tab targeting by hand — an affordance gap, which
is owned separately.

### Frame on the panel, but leave it to the user

This is the status quo: the activity banner offers "View N nodes". It is kept,
and it is not sufficient. The reported case had the button on screen and
untouched; the user's model was that nothing had been built, and the button
reads as a convenience for something you already believe exists.

## Consequences

- The camera moves without being asked, in one narrow case. The product
  already does exactly this when a human loads a template, so this is parity
  rather than a new behaviour class.
- A human pan or zoom during the 350 ms animation wins: `animateToBounds`
  abandons its own animation as soon as the camera state changes from
  anywhere else. Nothing extra was added to detect that.
- No change to placement, the applier, the document, or anything shared. The
  camera is local, ephemeral, FE-owned view state, so no replication invariant
  is engaged; follow-up work in this class cannot cite this decision as
  precedent for writing layout from view state.
- `ADR-CRDT-PLACEMENT-0035` keeps its exemption, and its rationale is now
  complete rather than half-implemented.
- Proof is black-box and stays that way:
  `browser_tests/tests/agent/agentEmptyCanvasBatchIsFramed.spec.ts` asserts
  the nodes keep the template's coordinates _and_ end up inside the canvas's
  visible area. It fails on the parent commit with all three nodes applied and
  none visible, which is the defect stated as a test.

### Revisit if

- A report arrives of the camera moving when the user had content on screen.
  The guard is the "no other node on the graph" condition; a batch counted as
  the whole canvas while the user had their own nodes would be the bug.
- Multi-writer editing lands and "the whole canvas is this batch" stops being
  a reliable proxy for "this user is looking at nothing".
- The binding-mismatch affordance ships. The other half of this symptom —
  the user watching a different tab from the one the agent writes to — is not
  addressed here and must not be read as covered by this decision.
