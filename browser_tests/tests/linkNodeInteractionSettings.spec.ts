import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { DefaultGraphPositions } from '@e2e/fixtures/constants/defaultGraphPositions'

const VAE_DECODE_SAMPLES_INPUT_SLOT = 0
const DEFAULT_GROUP_TITLE = 'Group'

test.describe('Link & node interaction settings', { tag: '@canvas' }, () => {
  test.describe('Comfy.LinkRelease.Action', () => {
    test('"search box" opens node search on link release', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.LinkRelease.Action',
        'search box'
      )
      await comfyPage.canvasOps.disconnectEdge()
      await expect(comfyPage.searchBoxV2.input).toBeVisible()
    })

    test('"context menu" opens litegraph connection menu on link release', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.LinkRelease.Action',
        'context menu'
      )
      await comfyPage.canvasOps.disconnectEdge()
      await expect(comfyPage.contextMenu.litegraphContextMenu).toBeVisible()
    })

    test('"no action" suppresses both search box and context menu', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.LinkRelease.Action',
        'no action'
      )
      await comfyPage.canvasOps.disconnectEdge()
      await expect(comfyPage.searchBoxV2.input).toBeHidden()
      await expect(comfyPage.contextMenu.litegraphContextMenu).toBeHidden()
    })
  })

  test.describe('Comfy.LinkRelease.ActionShift', () => {
    test('shift+drag dispatches to ActionShift (not Action)', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.LinkRelease.Action',
        'no action'
      )
      await comfyPage.settings.setSetting(
        'Comfy.LinkRelease.ActionShift',
        'search box'
      )

      await comfyPage.canvasOps.disconnectEdge({ modifiers: ['Shift'] })

      await expect(comfyPage.searchBoxV2.input).toBeVisible()
    })
  })

  test.describe('Comfy.Node.DoubleClickTitleToEdit', () => {
    test('enabled → double-click on node title opens editor', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Node.DoubleClickTitleToEdit',
        true
      )
      const [node] = await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      await comfyPage.canvasOps.mouseDblclickAt(await node.getTitlePosition())
      await comfyPage.titleEditor.expectVisible()
    })

    test('disabled → double-click on node title stays hidden', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Node.DoubleClickTitleToEdit',
        false
      )
      const [node] = await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      await comfyPage.canvasOps.mouseDblclickAt(await node.getTitlePosition())
      await comfyPage.titleEditor.expectHidden()
    })
  })

  test.describe('Comfy.Group.DoubleClickTitleToEdit', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('groups/single_group_only')
    })

    test('enabled → double-click on group title opens editor', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Group.DoubleClickTitleToEdit',
        true
      )
      await comfyPage.canvasOps.dblclickGroupTitle(DEFAULT_GROUP_TITLE)
      await comfyPage.titleEditor.expectVisible()
    })

    test('disabled → double-click on group title stays hidden', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Group.DoubleClickTitleToEdit',
        false
      )
      await comfyPage.canvasOps.dblclickGroupTitle(DEFAULT_GROUP_TITLE)
      await comfyPage.titleEditor.expectHidden()
    })
  })

  test.describe('Comfy.Node.BypassAllLinksOnDelete', () => {
    test('enabled → deleting KSampler bridges EmptyLatentImage → VAEDecode.samples', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Node.BypassAllLinksOnDelete',
        true
      )
      const [kSampler] = await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      const [emptyLatent] =
        await comfyPage.nodeOps.getNodeRefsByType('EmptyLatentImage')
      const [vaeDecode] = await comfyPage.nodeOps.getNodeRefsByType('VAEDecode')
      const vaeSamplesInput = await vaeDecode.getInput(
        VAE_DECODE_SAMPLES_INPUT_SLOT
      )

      await test.step('precondition: KSampler feeds VAEDecode.samples', async () => {
        expect(
          (await vaeSamplesInput.getLink())?.origin_id,
          'VAEDecode.samples should originate from KSampler before delete'
        ).toBe(kSampler.id)
      })

      await kSampler.delete()

      await expect
        .poll(async () => (await vaeSamplesInput.getLink())?.origin_id ?? null)
        .toBe(emptyLatent.id)
    })

    test('disabled → deleting KSampler drops VAEDecode.samples', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Node.BypassAllLinksOnDelete',
        false
      )
      const [kSampler] = await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      const [vaeDecode] = await comfyPage.nodeOps.getNodeRefsByType('VAEDecode')
      const vaeSamplesInput = await vaeDecode.getInput(
        VAE_DECODE_SAMPLES_INPUT_SLOT
      )

      await kSampler.delete()

      await expect.poll(() => vaeSamplesInput.getLink()).toBeNull()
    })
  })

  test.describe('Comfy.Node.MiddleClickRerouteNode', () => {
    async function countReroutes(comfyPage: ComfyPage): Promise<number> {
      return (await comfyPage.nodeOps.getNodeRefsByType('Reroute')).length
    }

    test('enabled → middle-click on an output slot creates a Reroute', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Node.MiddleClickRerouteNode',
        true
      )
      const before = await countReroutes(comfyPage)

      await comfyPage.canvasOps.middleClick(
        DefaultGraphPositions.loadCheckpointNodeClipOutputSlot
      )

      await expect.poll(() => countReroutes(comfyPage)).toBe(before + 1)
    })

    test('disabled → middle-click on an output slot does nothing', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Node.MiddleClickRerouteNode',
        false
      )
      const before = await countReroutes(comfyPage)

      await comfyPage.canvasOps.middleClick(
        DefaultGraphPositions.loadCheckpointNodeClipOutputSlot
      )
      await comfyPage.nextFrame()

      expect(await countReroutes(comfyPage)).toBe(before)
    })
  })
})
