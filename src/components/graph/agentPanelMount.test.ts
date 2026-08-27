import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Source-structure pins for the two graph-side agent-panel mount
// invariants. Rendering the real overlay/canvas pair needs the full
// splitter + store + canvas stack, so these follow the in-file precedent
// of LiteGraphCanvasSplitterOverlay.test.ts (source assertions); the
// rendered single-instance property is exercised by the agent E2E.

const overlaySource = readFileSync(
  join(__dirname, '../LiteGraphCanvasSplitterOverlay.vue'),
  'utf-8'
)
const graphCanvasSource = readFileSync(
  join(__dirname, 'GraphCanvas.vue'),
  'utf-8'
)

describe('the graph-side agent panel mount', () => {
  it('keeps the agent-panel slot a sibling of the workspace column, not a descendant', () => {
    // The slot must sit at root depth, after the column wrapper closes -
    // exactly the flex-row restructure that makes the dock a right-hand
    // sibling. Nesting it inside the column would re-indent this tail.
    expect(overlaySource).toMatch(
      /\n {4}<\/div>\n\n {4}<slot name="agent-panel" \/>\n {2}<\/div>\n<\/template>/
    )
  })

  it('guards the docked panel against linear mode (GraphCanvas stays mounted there)', () => {
    // GraphView keeps GraphCanvas alive via v-show in linear mode while
    // LinearView mounts its own dock; without this guard both docks render
    // at once and every strict-mode locator on the panel breaks.
    expect(graphCanvasSource).toMatch(
      /<DockedAgentPanel v-if="!linearMode" \/>/
    )
  })
})
