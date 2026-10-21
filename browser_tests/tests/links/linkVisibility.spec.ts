import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/linkVisibilityFixture'
import {
  expectRegionScreenshot,
  screenshotRegion
} from '@e2e/fixtures/utils/screenshotRegion'

test.use({
  initialSettings: { 'Comfy.UseNewMenu': 'Disabled' }
})

test(
  'undoes and redoes hiding a shared reroute segment in one step',
  { tag: '@canvas' },
  async ({ comfyPage, linkVisibility }) => {
    await comfyPage.workflow.loadWorkflow('reroute/shared-hidden-links')
    await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(0)

    await linkVisibility.hideRerouteSegment(toRerouteId(2))

    const hidden = { '33': { hidden: true }, '34': { hidden: true } }
    await expect
      .poll(
        async () =>
          (await comfyPage.workflow.getExportedWorkflow()).extra
            ?.linkPresentation
      )
      .toEqual(hidden)
    await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(1)

    await comfyPage.keyboard.undo()

    await expect
      .poll(
        async () =>
          (await comfyPage.workflow.getExportedWorkflow()).extra
            ?.linkPresentation ?? {}
      )
      .toEqual({})
    await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(0)
    await expect.poll(() => comfyPage.workflow.getRedoQueueSize()).toBe(1)

    await comfyPage.keyboard.redo()

    await expect
      .poll(
        async () =>
          (await comfyPage.workflow.getExportedWorkflow()).extra
            ?.linkPresentation
      )
      .toEqual(hidden)
    await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(1)
    await expect.poll(() => comfyPage.workflow.getRedoQueueSize()).toBe(0)
  }
)

test.describe('Hidden link badges', { tag: ['@canvas', '@screenshot'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('reroute/native_reroute')
  })

  test('hides and restores a link from canvas gestures', async ({
    comfyPage,
    linkVisibility
  }) => {
    const region = await screenshotRegion(
      comfyPage.page,
      await comfyPage.nodeOps.getAllNodeRefs()
    )
    await region.expectScreenshot('link-visible.png')

    await test.step('Hide the link', async () => {
      await linkVisibility.hideFirstLink()
      await region.expectScreenshot('link-hidden.png')
    })

    await test.step('Hovering the badge reveals the hidden link', async () => {
      await linkVisibility.hoverFirstHiddenLink()
      await region.expectScreenshot('link-hidden-revealed.png')
    })

    await test.step('Leaving the badge hides the link again', async () => {
      await linkVisibility.parkPointer()
      await region.expectScreenshot('link-hidden.png')
    })

    await test.step('Show the link', async () => {
      await linkVisibility.showFirstHiddenLink()
      await region.expectScreenshot('link-visible.png')
    })
  })

  test('a hidden link snaps back and settles behind its badge', async ({
    comfyPage,
    linkVisibility
  }) => {
    await linkVisibility.hideFirstLink()

    await expect
      .poll(async () =>
        Object.values(
          (await comfyPage.workflow.getExportedWorkflow()).extra
            ?.linkPresentation ?? {}
        )
      )
      .toEqual([{ hidden: true }])
    await expectRegionScreenshot(
      comfyPage.page,
      await comfyPage.nodeOps.getAllNodeRefs(),
      'link-hidden.png'
    )
  })

  test('persists a hidden renamed link through graph load and browser reload', async ({
    comfyPage,
    linkVisibility
  }) => {
    await linkVisibility.hideFirstLink()

    const serialized = await comfyPage.workflow.getExportedWorkflow()
    const serializedLink = serialized.links?.[0]
    if (!serializedLink) throw new Error('Exported workflow link was not found')
    const linkId = String(
      Array.isArray(serializedLink) ? serializedLink[0] : serializedLink.id
    )
    expect(serialized.extra?.linkPresentation).toEqual({
      [linkId]: { hidden: true }
    })

    await comfyPage.workflow.loadGraphData(serialized)
    await comfyPage.nextFrame()

    await expectRegionScreenshot(
      comfyPage.page,
      await comfyPage.nodeOps.getAllNodeRefs(),
      'link-hidden.png'
    )

    await linkVisibility.openRenamePrompt()

    await expect(linkVisibility.promptInput).toHaveValue('')

    await linkVisibility.promptInput.fill('Renamed badge')
    await linkVisibility.promptInput.press('Enter')

    await expect(linkVisibility.promptInput).toBeHidden()
    await expect
      .poll(async () => {
        const workflow = await comfyPage.workflow.getExportedWorkflow()
        return workflow.extra?.linkPresentation?.[linkId]
      })
      .toEqual({ hidden: true, label: 'Renamed badge' })

    await comfyPage.workflow.reloadAndWaitForApp()

    await expect
      .poll(async () => {
        const workflow = await comfyPage.workflow.getExportedWorkflow()
        return workflow.extra?.linkPresentation?.[linkId]
      })
      .toEqual({ hidden: true, label: 'Renamed badge' })
  })
})

test.describe(
  'Stacked hidden link badges',
  { tag: ['@canvas', '@screenshot'] },
  () => {
    const checkpointLoaderId = toNodeId(4)
    const clipSlot = 1
    const firstClipLinkId = '3'

    test.beforeEach(async ({ comfyPage, linkVisibility }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await linkVisibility.hideLinksFromOutput(checkpointLoaderId, clipSlot)
    })

    test('collapses links from one output and reveals them all on hover', async ({
      comfyPage,
      linkVisibility
    }) => {
      const region = await screenshotRegion(comfyPage.page, [
        await comfyPage.nodeOps.getNodeRefById(checkpointLoaderId),
        ...(await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode'))
      ])
      await region.expectScreenshot('link-stack-collapsed.png')

      await linkVisibility.hoverOutputBadgeRow(checkpointLoaderId, clipSlot, 0)
      await region.expectScreenshot('link-stack-hover-reveals-all.png')
    })

    test('expands on click and hovering one label reveals only that link', async ({
      comfyPage,
      linkVisibility
    }) => {
      await linkVisibility.clickOutputBadgeRow(checkpointLoaderId, clipSlot, 0)
      await linkVisibility.hoverOutputBadgeRow(checkpointLoaderId, clipSlot, 1)

      await expectRegionScreenshot(
        comfyPage.page,
        [
          await comfyPage.nodeOps.getNodeRefById(checkpointLoaderId),
          ...(await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode'))
        ],
        'link-stack-expanded-hover-one.png'
      )
    })

    test('renaming an expanded label moves it out of the stack', async ({
      comfyPage,
      linkVisibility
    }) => {
      await linkVisibility.clickOutputBadgeRow(checkpointLoaderId, clipSlot, 0)

      await test.step('Rename the first expanded label', async () => {
        await linkVisibility.openRenamePromptAtOutputBadgeRow(
          checkpointLoaderId,
          clipSlot,
          1
        )
        await expect(linkVisibility.promptInput).toHaveValue('')
        await linkVisibility.promptInput.fill('Positive clip')
        await linkVisibility.promptInput.press('Enter')
        await expect(linkVisibility.promptInput).toBeHidden()
        await expect
          .poll(
            async () =>
              (await comfyPage.workflow.getExportedWorkflow()).extra
                ?.linkPresentation?.[firstClipLinkId]
          )
          .toEqual({ hidden: true, label: 'Positive clip' })
      })

      await test.step('The renamed label sits below the remaining link', async () => {
        await linkVisibility.parkPointer()
        await linkVisibility.openRenamePromptAtOutputBadgeRow(
          checkpointLoaderId,
          clipSlot,
          1
        )
        await expect(linkVisibility.promptInput).toHaveValue('Positive clip')
      })
    })
  }
)

test.describe(
  'Hidden link Vue slot reveal',
  { tag: ['@canvas', '@vue-nodes', '@screenshot'] },
  () => {
    test('reveals the link while connected input and output slots are hovered or dragged', async ({
      comfyPage,
      comfyMouse,
      linkVisibility
    }) => {
      await comfyPage.workflow.loadWorkflow('reroute/native_reroute')

      const sourceNode =
        await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
      const targetNode =
        await comfyPage.vueNodes.getFixtureByTitle('VAE Decode')
      const inputSlot = targetNode.getSlot('vae')
      const outputSlot = sourceNode.getSlot('VAE')
      await expect(inputSlot).toBeVisible()
      await expect(outputSlot).toBeVisible()

      const outputBox = (await outputSlot.boundingBox())!
      const start = {
        x: outputBox.x + outputBox.width / 2,
        y: outputBox.y + outputBox.height / 2
      }
      const dragTo = { x: start.x + 160, y: start.y + 120 }
      const region = await screenshotRegion(comfyPage.page, [
        sourceNode.root,
        targetNode.root,
        dragTo
      ])

      await test.step('Hide the link', async () => {
        await linkVisibility.hideLinkBetween({
          sourceTitle: 'Load Checkpoint',
          outputName: 'VAE',
          targetTitle: 'VAE Decode',
          inputName: 'vae'
        })
        await region.expectScreenshot('vue-link-hidden.png')
      })

      await test.step('Input hover reveals the hidden link', async () => {
        await inputSlot.hover()
        await comfyPage.nextFrame()
        await region.expectScreenshot('vue-link-revealed-from-input.png')
      })

      await test.step('Leaving the input hides the link again', async () => {
        await linkVisibility.parkPointer()
        await region.expectScreenshot('vue-link-hidden.png')
      })

      await test.step('Output hover reveals the hidden link', async () => {
        await outputSlot.hover()
        await comfyPage.nextFrame()
        await region.expectScreenshot('vue-link-revealed-from-output.png')
      })

      await test.step('Leaving the output hides the link again', async () => {
        await linkVisibility.parkPointer()
        await region.expectScreenshot('vue-link-hidden.png')
      })

      await test.step('Dragging away from the output keeps the link revealed', async () => {
        await comfyMouse.move(start)
        await comfyMouse.drag(dragTo)
        await region.expectScreenshot(
          'vue-link-revealed-while-dragging-output.png'
        )
      })

      await test.step('Dropping the drag hides the link again', async () => {
        await comfyMouse.move(start)
        await comfyMouse.drop()
        await linkVisibility.parkPointer()
        await region.expectScreenshot('vue-link-hidden.png')
      })
    })
  }
)
