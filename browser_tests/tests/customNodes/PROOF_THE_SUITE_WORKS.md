# Proof the custom-node CI suite catches real regressions

**This branch (`nathaniel/detection-proof`, PR #13534) is never merged.** It exists
to answer the one question a green test suite cannot: _would the custom-nodes CI
actually catch a real regression in a custom node, or does it just look green?_

## Why "CI is green" is not the same as "custom nodes are protected"

A green run only proves nothing is broken **right now**. It does not prove the
suite would **catch** a break. A test that asserts nothing, or asserts the wrong
thing, is also green. Even 100% code coverage does not close this gap: a line can
execute (be "covered") without any assertion that fails when it misbehaves. So
"the suite passes" and "the suite protects custom nodes" are two different claims.
The second is the one we care about, and it needs different evidence.

## How we prove it: break it on purpose (falsification)

We take the current suite and deliberately introduce **one real regression per
surface the suite claims to guard**, each mirroring a class of bug that has
actually shipped before. Then we watch the suite. If each break turns the suite
**red with its own specific, attributable failure**, the suite demonstrably
detects that class of regression. All ten breaks are live at once, so a single CI
run reds across every tier.

The load-bearing property is **specificity**. It is not enough that "something
went red." Each break must red _its_ tier with _its_ signature. That is what
proves ten independent detections instead of one globally fragile suite.

## The ten breaks and the exact red each one produces

| #   | Surface guarded            | What we broke                                                     | Tier that catches it | The red signature                                   |
| --- | -------------------------- | ----------------------------------------------------------------- | -------------------- | --------------------------------------------------- |
| 1   | Mount, canvas (v1)         | `litegraphService.addInputs` stops materializing the last input   | mount                | `instance is missing declared input "value"`        |
| 2   | Mount, DOM (Vue Nodes 2.0) | `useProcessedWidgets` skips numeric widgets                       | mount (Vue pass)     | `Vue mounts 1 of 5 widgets`                         |
| 3   | Persistence (save/reload)  | `LGraphNode.configure` off-by-one drops the last saved value      | persistence          | `widgets_values [...,8] -> [...,0]` on reload       |
| 4   | Wiring by type             | `isValidConnection` rejects IMAGE links                           | connectivity sweep   | `CONNECT_REJECTED` across the pair list             |
| 5   | Wiring by drag/drop        | `measureSlots.getNodeInputOnPos` never resolves a slot            | connectivity drag    | drag `EmptyImage.IMAGE -> ImageBatch.image2` fails  |
| 6   | Execution (prompt build)   | `executionUtil` drops numeric widget values from the prompt       | curated run (T1)     | `Prompt outputs failed validation`                  |
| 7   | Load hook / no-error guard | `useNodeBadge.afterConfigureGraph` throws on graph load           | curated run (T1)     | `Error calling extension ... afterConfigureGraph`   |
| 8   | Pack console errors        | CI patches Custom-Scripts `showText.js` to `console.error` on run | curated run (T1)     | `console errors during curated run` + the text      |
| 9   | Pack runtime               | CI patches WAS `return_constant_number` to raise                  | auto-run             | `Constant Number: EXECUTION_ERROR ... a regression` |
| 10  | Pack registration          | CI renames Impact's `ImpactInt` node key                          | zero-skip gate       | job reds on `skipped != 0`                          |

Rows 1-7 are frontend breaks committed on this branch. Rows 8-10 are
**pack-shipped** bugs: a normal frontend commit cannot reach third-party pack
code, so a CI step patches each cloned pack at install time (this branch only).
Each break also cites the historical bug class it mirrors. The full mapping, the
real tickets, and the why-this-break-and-not-another notes are in
[DETECTION_PROOF.md](DETECTION_PROOF.md); the suite's design is in
[ARCHITECTURE.md](ARCHITECTURE.md).

## How to read the result

The `custom-nodes-e2e` check on this PR is **red, and the red is the pass.** A
clean run reports:

> **23 failed / 2 skipped / 61 passed**

- Every one of the **23 failures** maps to a specific break above (the ten breaks
  fail across multiple tiers and retries).
- The **2 skips** are row 10: the renamed node no longer registers, which trips
  the suite's zero-skip gate. That skip is itself a detection.
- The **61 passes** show the suite still runs normally end to end. It is not just
  globally broken, which is exactly what makes the 23 reds meaningful rather than
  noise.

It is a standing demo: re-run it anytime and you get the same signature. If the
suite ever _stopped_ catching one of these, that break's row would go green, and
that green would be the alarm.

## What this does and does not prove

- **It proves:** the suite detects these ten regression _classes_ on real
  community packs, each with an attributable failure. That is direct evidence it
  would catch the same bug shape in a real PR.
- **It does not prove:** that every conceivable custom-node bug is caught. This is
  a per-PR gate over mount, persistence, wiring, execution, and registration. It
  does not check output correctness and it is not a long-soak test. New surfaces
  need new rows.
