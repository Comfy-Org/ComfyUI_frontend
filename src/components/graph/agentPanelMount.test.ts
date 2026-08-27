import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Source pins, per the LiteGraphCanvasSplitterOverlay.test.ts precedent;
// the agent E2E covers the rendered single-instance property.

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
    // Root depth after the column wrapper = the dock is a flex-row sibling.
    expect(overlaySource).toMatch(
      /\n {4}<\/div>\n\n {4}<slot name="agent-panel" \/>\n {2}<\/div>\n<\/template>/
    )
  })

  it('guards the docked panel against linear mode (GraphCanvas stays mounted there)', () => {
    // LinearView mounts its own dock; two at once breaks strict-mode locators.
    expect(graphCanvasSource).toMatch(
      /<DockedAgentPanel v-if="!linearMode" \/>/
    )
  })
})
