import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

import {
  PACK_RENDERERS,
  PACK_TAGS,
  addPackNode,
  countColour,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  nodeScreenRect,
  showEmptyGraphAtZoomOne
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  BADGE_GREEN,
  expectOverlayInsideNodeAndFollowingPan
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.mixlab'

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
