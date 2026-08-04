import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Point } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'

const LEGACY_TITLE_HEIGHT = 30

interface NodeGeometry {
  pos: Point
  size: Point
  inputs: Point[]
  outputs: Point[]
}

/**
 * Read slots through the accessors used by `drawConnections`; raw fields
 * bypass the store projection under test.
 */
async function readGeometry(
  comfyPage: ComfyPage,
  nodeId: NodeId
): Promise<NodeGeometry> {
  return comfyPage.page.evaluate((id): NodeGeometry => {
    const node = window.app?.canvas.graph?.getNodeById(id)
    if (!node) throw new Error(`Node ${id} not found`)

    return {
      pos: [node.pos[0], node.pos[1]],
      size: [node.size[0], node.size[1]],
      inputs: node.inputs.map((_, i) => node.getInputPos(i)),
      outputs: node.outputs.map((_, i) => node.getOutputPos(i))
    }
  }, nodeId)
}

function slotsOf(geometry: NodeGeometry): Point[] {
  return [...geometry.inputs, ...geometry.outputs]
}

function expectSlotsTrackedNode(after: NodeGeometry, before: NodeGeometry) {
  const dx = after.pos[0] - before.pos[0]
  const dy = after.pos[1] - before.pos[1]
  expect(Math.abs(dx) + Math.abs(dy), 'drag moved the node').toBeGreaterThan(1)

  const beforeSlots = slotsOf(before)
  const afterSlots = slotsOf(after)
  expect(afterSlots, 'slot count after drag').toHaveLength(beforeSlots.length)
  afterSlots.forEach(([x, y], i) => {
    expect(x, `slot ${i} x tracked the node`).toBeCloseTo(
      beforeSlots[i][0] + dx,
      0
    )
    expect(y, `slot ${i} y tracked the node`).toBeCloseTo(
      beforeSlots[i][1] + dy,
      0
    )
  })
}

function expectGeometryPreserved(
  actual: NodeGeometry,
  reference: NodeGeometry,
  label: string
) {
  expect(actual.pos[0], `${label}: x`).toBeCloseTo(reference.pos[0], 0)
  expect(actual.pos[1], `${label}: y`).toBeCloseTo(reference.pos[1], 0)
  expect(actual.size, `${label}: size`).toEqual(reference.size)

  const referenceSlots = slotsOf(reference)
  const actualSlots = slotsOf(actual)
  expect(actualSlots, `${label}: slot count`).toHaveLength(
    referenceSlots.length
  )
  actualSlots.forEach(([x, y], i) => {
    expect(x, `${label}: slot ${i} x`).toBeCloseTo(referenceSlots[i][0], 0)
    expect(y, `${label}: slot ${i} y`).toBeCloseTo(referenceSlots[i][1], 0)
  })
}

/**
 * Renderers compute different slot offsets, so require slots only to remain
 * within their node bounds.
 */
function expectSlotsOnNode(geometry: NodeGeometry, label: string) {
  const MARGIN = 20
  const [x, y] = geometry.pos
  const [width, height] = geometry.size

  slotsOf(geometry).forEach(([slotX, slotY], i) => {
    expect(slotX, `${label}: slot ${i} x within node`).toBeGreaterThanOrEqual(
      x - MARGIN
    )
    expect(slotX, `${label}: slot ${i} x within node`).toBeLessThanOrEqual(
      x + width + MARGIN
    )
    expect(slotY, `${label}: slot ${i} y within node`).toBeGreaterThanOrEqual(
      y - LEGACY_TITLE_HEIGHT - MARGIN
    )
    expect(slotY, `${label}: slot ${i} y within node`).toBeLessThanOrEqual(
      y + height + MARGIN
    )
  })
}

async function setVueMode(comfyPage: ComfyPage, enabled: boolean) {
  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', enabled)
  if (enabled) await comfyPage.vueNodes.waitForNodes()
  await comfyPage.nextFrame()
}

test.describe('Renderer toggle geometry', { tag: ['@vue-nodes'] }, () => {
  test('slot geometry survives a Vue to legacy round trip', async ({
    comfyPage
  }) => {
    const nodeId = toNodeId(
      await comfyPage.vueNodes.getNodeIdByTitle('KSampler')
    )

    const before = await readGeometry(comfyPage, nodeId)
    expect(
      slotsOf(before).length,
      'fixture node must have slots for this test to mean anything'
    ).toBeGreaterThan(0)

    const { header } = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    const headerBox = await header.boundingBox()
    if (!headerBox) throw new Error('KSampler header not found')

    const startX = headerBox.x + headerBox.width / 2
    const startY = headerBox.y + headerBox.height / 2
    await comfyPage.page.mouse.move(startX, startY)
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(startX + 120, startY + 90, { steps: 10 })
    await comfyPage.page.mouse.up()
    await comfyPage.nextFrame()

    const moved = await readGeometry(comfyPage, nodeId)
    expectSlotsTrackedNode(moved, before)

    await setVueMode(comfyPage, false)

    const legacyGeometry = await readGeometry(comfyPage, nodeId)
    expect(legacyGeometry.pos[0], 'legacy x').toBeCloseTo(moved.pos[0], 0)
    expect(legacyGeometry.pos[1], 'legacy y').toBeCloseTo(moved.pos[1], 0)
    expect(legacyGeometry.size, 'legacy size').toEqual(moved.size)
    expectSlotsOnNode(legacyGeometry, 'after switching to legacy')

    await setVueMode(comfyPage, true)

    expectGeometryPreserved(
      await readGeometry(comfyPage, nodeId),
      moved,
      'after switching back to Vue'
    )
  })
})
