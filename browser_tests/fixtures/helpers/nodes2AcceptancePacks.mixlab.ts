import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Locator } from '@playwright/test'
import {
  nodeScreenRect,
  padRect
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  contains,
  panCanvasBy
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.a2'

export const BADGE_GREEN = [15, 31, 15] as const

const PAN = { x: 250, y: 120 } as const

export async function expectOverlayInsideNodeAndFollowingPan(
  comfyPage: ComfyPage,
  nodeId: NodeId,
  overlay: Locator
) {
  await expect(overlay).toBeVisible()
  await expect(async () => {
    const box = await overlay.boundingBox()
    expect(box, 'overlay has a box').not.toBeNull()
    expect(
      contains(padRect(await nodeScreenRect(comfyPage, nodeId), 4), box!),
      'overlay inside the node'
    ).toBe(true)
  }).toPass({ timeout: 10_000 })
  const before = (await overlay.boundingBox())!

  await panCanvasBy(comfyPage, PAN.x, PAN.y)

  await expect(async () => {
    const after = (await overlay.boundingBox())!
    expect(after.x - before.x, 'overlay x follows the pan').toBeCloseTo(
      PAN.x,
      -1
    )
    expect(after.y - before.y, 'overlay y follows the pan').toBeCloseTo(
      PAN.y,
      -1
    )
    expect(
      contains(padRect(await nodeScreenRect(comfyPage, nodeId), 4), after),
      'overlay inside the node after panning'
    ).toBe(true)
  }).toPass({ timeout: 10_000 })
}
