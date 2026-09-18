---
name: contain-audit
description: 'Detect DOM elements where CSS contain:layout+style would improve rendering performance. Runs a Playwright-based audit on a large workflow, scores candidates by subtree size and sizing constraints, measures performance impact, and generates a ranked report.'
---

# CSS Containment Audit

Automatically finds DOM elements where adding `contain: layout style` would reduce browser recalculation overhead.

## What It Does

1. Loads a large workflow (245 nodes) in a real browser
2. Walks the DOM tree and scores every element as a containment candidate
3. For each high-scoring candidate, applies `contain: layout style` via JavaScript
4. Measures rendering performance (style recalcs, layouts, task duration) before and after
5. Takes before/after screenshots to detect visual breakage
6. Generates a ranked report with actionable recommendations

## When to Use

- After adding new Vue components to the node rendering pipeline
- When investigating rendering performance on large workflows
- Before and after refactoring node DOM structure
- As part of periodic performance audits

## How to Run

```bash
# Start the dev server first
pnpm dev &

# Run the audit (uses the @audit tag, not included in normal CI runs)
pnpm exec playwright test browser_tests/tests/containAudit.spec.ts --project=audit

# View the HTML report
pnpm exec playwright show-report
```

## How to Read Results

The audit outputs a table to the console:

```text
CSS Containment Audit Results
=======================================================
Rank | Selector                        | Subtree | Score | DRecalcs | DLayouts | Visual
  1  | [data-testid="node-inner-wrap"] |     18  |  72   |    -34%  |    -12%  |   OK
  2  | .node-body                      |     12  |  48   |     -8%  |     -3%  |   OK
  3  | .node-header                    |      4  |  16   |     +1%  |      0%  |   OK
```

- **Subtree**: Number of descendant elements (higher = more to skip)
- **Score**: Composite heuristic score (subtree size x sizing constraint bonus)
- **DRecalcs / DLayouts**: Change in style recalcs / layout counts vs baseline (negative = improvement)
- **Visual**: OK if no pixel change, DIFF if screenshot differs (may include subpixel noise — verify manually)

## Candidate Scoring

An element is a good containment candidate when:

1. **Large subtree** -- many descendants that the browser can skip recalculating
2. **Externally constrained size** -- width/height determined by CSS variables, flex, or explicit values (not by content)
3. **No existing containment** -- `contain` is not already applied
4. **Not a leaf** -- has at least a few child elements

Elements that should NOT get containment:

- Elements whose children overflow visually beyond bounds (e.g., absolute-positioned overlays with negative inset)
- Elements whose height is determined by content and affects sibling layout
- Very small subtrees (overhead of containment context outweighs benefit)

## Limitations

- Cannot fully guarantee `contain` safety -- visual review of screenshots is required
- Performance measurements have natural variance; run multiple times for confidence
- Only tests idle and pan scenarios; widget interactions may differ
- The audit modifies styles at runtime via JS, which doesn't account for Tailwind purging or build-time optimizations

## Example PR

[#9946 — fix: add CSS contain:layout contain:style to node inner wrapper](https://github.com/Comfy-Org/ComfyUI_frontend/pull/9946)

This PR added `contain-layout contain-style` to the node inner wrapper div in `LGraphNode.vue`. The audit tool would have flagged this element as a high-scoring candidate because:

- **Large subtree** (18+ descendants: header, slots, widgets, content, badges)
- **Externally constrained size** (`w-(--node-width)`, `flex-1` — dimensions set by CSS variables and flex parent)
- **Natural isolation boundary** between frequently-changing content (widgets) and infrequently-changing overlays (selection outlines, borders)

The actual change was a single line: adding `'contain-layout contain-style'` to the inner wrapper's class list at `src/renderer/extensions/vueNodes/components/LGraphNode.vue:79`.

## Reference

| Resource          | Path                                                    |
| ----------------- | ------------------------------------------------------- |
| Audit test        | `browser_tests/tests/containAudit.spec.ts`              |
| PerformanceHelper | `browser_tests/fixtures/helpers/PerformanceHelper.ts`   |
| Perf tests        | `browser_tests/tests/performance.spec.ts`               |
| Large workflow    | `browser_tests/assets/large-graph-workflow.json`        |
| Example PR        | https://github.com/Comfy-Org/ComfyUI_frontend/pull/9946 |
