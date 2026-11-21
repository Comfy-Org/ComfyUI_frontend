import type { NodeId } from '@comfyorg/graph-model/nodeId'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Locator } from '@playwright/test'
import {
  PACK_RENDERERS,
  PACK_TAGS,
  addPackNode,
  countColour,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  nodeScreenRect,
  padRect,
  showEmptyGraphAtZoomOne
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  contains,
  panCanvasBy
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.a2'

const BADGE_GREEN = [15, 31, 15] as const
const PAN = { x: 250, y: 120 } as const

async function expectOverlayInsideNodeAndFollowingPan(
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

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `comfyui-mixlab-nodes on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await expectPackLoaded(comfyPage, 'comfyui-mixlab-nodes')
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('Grid Input overlay buttons sit inside the node and follow a pan', async ({
        comfyPage
      }) => {
        await keepMixlabOffNodeDrawHooks(comfyPage)
        const id = await addPackNode(
          comfyPage,
          'GridInput',
          [150, 150],
          [420, 360]
        )
        await expectOverlayInsideNodeAndFollowingPan(
          comfyPage,
          id,
          comfyPage.page.getByRole('button', { name: 'Add Box' })
        )
      })

      test('SVG Image overlay upload field sits inside the node and follows a pan', async ({
        comfyPage
      }) => {
        await keepMixlabOffNodeDrawHooks(comfyPage)
        const id = await addPackNode(
          comfyPage,
          'SvgImage',
          [150, 150],
          [420, 360]
        )
        await expectOverlayInsideNodeAndFollowingPan(
          comfyPage,
          id,
          comfyPage.page.locator('input[type="file"].Svg')
        )
      })

      test('Node badge with the node id is drawn above the node', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          'GridInput',
          [150, 200],
          [420, 360]
        )
        await expect
          .poll(
            async () => {
              const rect = await nodeScreenRect(comfyPage, id)
              return countColour(
                comfyPage,
                { x: rect.x, y: rect.y - 30, width: rect.width, height: 34 },
                BADGE_GREEN,
                3
              )
            },
            { message: 'badge background pixels above the node' }
          )
          .toBeGreaterThan(150)
      })
    }
  )
}
