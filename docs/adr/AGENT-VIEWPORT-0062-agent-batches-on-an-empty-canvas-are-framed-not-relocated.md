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

- the batch added at least one node;
- **no other node is on the graph** — the batch is the entire canvas;
- the viewport has been measured — finite, with positive width and height; and
- **no node of the batch** overlaps it.

`AgentGraphActivityBar` then calls the same `animateToBounds` path the "View
nodes" button already used, and records the turn as framed only when that call
actually started a camera move.

Everything outside that intersection is unchanged. A batch landing beside
content the user is already looking at does not move the camera:
`ADR-CRDT-PLACEMENT-0035` has already parked it next to that content, and
taking the camera off what someone was working on is a worse defect than the
one being fixed. An unmeasured camera does not frame either — an unknown
viewport is not evidence that the batch is invisible, and a wrong move costs
the user their position.

### Four details the first implementation got wrong

Each of these was raised in review on the carrier and is recorded here rather
than as a comment in the code.

**The viewport is the uncovered canvas panel, not `ds.visible_area`.**
`ds.visible_area` is recomputed from the whole canvas element on draw, and the
canvas element extends underneath the side panels — including the docked agent
panel, which is open during exactly this flow. A batch that landed only under
that panel would have counted as on screen and never been framed. Both the
decision and the camera move now use the intersection of the
`.graph-canvas-panel` rect and `measuredVisibleCanvasViewport`. Eligibility converts
it to graph coordinates; the animation receives CSS pixels.
The first excludes layout-taking bottom and side panels; the
second excludes the responsive Agent overlay that is teleported over the
canvas without taking layout space. `app.ts`'s `fitViewUnlessGraphInView` is
the same shape for the human template flow.

**"Measured" is a positive area, not a non-null reference.** `ds.visible_area`
is a `Rectangle` that starts life as `[0, 0, 0, 0]` and is only recomputed on
draw, so it is never null and can be stale after a tab switch. A zero-area
viewport intersects nothing, which would have read as "the batch is invisible"
and moved an unmeasured camera. The guard is on the dimensions.

**The test is per node and unpadded.** Framing pads the hull by 40 graph units
so the batch is not flush against the edge; using that padded hull to decide
_whether_ to frame counted two invisible cases as visible — a node up to 40
units past an edge, and nodes that surround the viewport so their combined hull
covers it without any node entering it. The padding stays on `animateToBounds`
only.

**The once-per-turn guard is keyed by turn, and spent only on success.** It was
keyed by workflow and graph id and reset whenever the activity state went
briefly null, which both let the same turn move the camera again after the user
deliberately panned away, and let a coalesced idle-to-new-turn transition on
the same target keep the old key so a new off-screen batch was never framed.
The store now owns a framing bit that resets only when a distinct turn starts
or the report is dismissed, so remounting the activity bar does not re-arm the
same turn. Presentation-only phase changes do not schedule another attempt.
The component reacts to the canvas store's displayed-graph identity and
revalidates that identity when its debounce fires, so subgraph navigation
cannot apply cached root-graph bounds to another camera. Separately,
`viewNodes()` can return without moving anything: no `.graph-canvas-panel`, no
measurable bounds, or a zero-area panel, including the graph canvas hidden in
linear mode. It reports whether it started the animation and the turn is marked
framed only then. Otherwise a later materialization or return to the target
graph retries.

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

### Frame the settled burst, and do not follow the build

A batch does not always arrive in one frame. The decision is therefore
debounced by 150 ms, so a materialization burst produces one framing on the
combined hull rather than a hard zoom onto whichever node resolved first.

What this deliberately does **not** do is keep re-framing as the build grows.
Two alternatives were considered and rejected:

- _Defer framing until the turn settles._ That reinstates the defect for the
  length of the build: the user asked for a workflow and watches an empty
  canvas while it is written.
- _Re-frame on every materialization._ Once the first framing lands, the batch
  overlaps the viewport, so the only way a later addition re-frames is if
  nothing of the batch is on screen — which is also what a user who
  deliberately panned away looks like. Re-framing then fights the user's
  camera, and `Revisit if` below calls that the worse defect.

So a genuinely incremental build spread over seconds frames its first settled
burst and leaves the rest to the "View N nodes" button. The residual is a
suboptimal framing, not an invisible canvas, which is the defect this decision
owns.

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
  the nodes keep the template's coordinates _and_ end up inside the part of
  the canvas no panel covers. It fails on the parent commit with all three
  nodes applied and none visible, which is the defect stated as a test.
- `browser_tests/tests/agent/agentGraphActivity.spec.ts` is the opposing
  guard and stays green: on a canvas that already has the user's content, an
  agent write still never moves the camera, and "View nodes" is still what
  frames the batch.

### Revisit if

- A report arrives of the camera moving when the user had content on screen.
  The guard is the "no other node on the graph" condition; a batch counted as
  the whole canvas while the user had their own nodes would be the bug.
- Multi-writer editing lands and "the whole canvas is this batch" stops being
  a reliable proxy for "this user is looking at nothing".
- A report arrives of a long incremental build leaving most of the workflow
  off screen after its first burst was framed. The fix then is a way to tell
  "the camera is still where we left it" from "the user moved it", which this
  decision does not have.
- The binding-mismatch affordance ships. The other half of this symptom —
  the user watching a different tab from the one the agent writes to — is not
  addressed here and must not be read as covered by this decision.
