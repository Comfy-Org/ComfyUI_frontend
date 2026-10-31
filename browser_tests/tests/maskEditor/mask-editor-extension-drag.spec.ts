import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { maskEditorExtensionTest as test } from '@e2e/fixtures/maskEditorExtensionFixture'

test.describe(
  'MaskEditor extension drag',
  { tag: ['@canvas', '@vue-nodes'] },
  () => {
    test.beforeEach(
      async ({ comfyPage, comfyFiles, extensionTool, maskEditor }) => {
        await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
        await extensionTool.register({ alternateTool: true })
        const filename = await extensionTool.uploadAsymmetricImage(
          comfyPage.vueNodes
            .getNodeByTitle('Load Image')
            .locator('input[type="file"]')
        )
        comfyFiles.deleteAfterTest({ filename, type: 'input' })
        await expect(maskEditor.previewImage).toHaveAttribute(
          'src',
          new RegExp(filename)
        )
        await maskEditor.reopenDialog()
        await extensionTool.tool.click()
        await expect(extensionTool.apply).toBeVisible()
      }
    )

    test('a drag ending outside the pointer zone delivers one terminal pointer up', async ({
      comfyPage,
      extensionTool
    }) => {
      await extensionTool.startDrag()
      await extensionTool.moveOutside()
      await comfyPage.page.mouse.up()
      await expect
        .poll(async () =>
          (await extensionTool.getPointerEvents())
            .filter((event) => event.phase !== 'move')
            .map((event) => event.phase)
        )
        .toEqual(['down', 'up'])
      const events = await extensionTool.getPointerEvents()
      expect(events.at(-1)).toMatchObject({ phase: 'up', inBounds: false })
    })

    test('losing pointer capture cancels once without a duplicate physical up', async ({
      comfyPage,
      extensionTool
    }) => {
      const { x, y, pointerId } = await extensionTool.startDrag()
      await extensionTool.pointerZone.evaluate(
        (zone, id) => zone.releasePointerCapture(id),
        pointerId
      )
      await comfyPage.page.mouse.move(x + 5, y + 5)
      await expect
        .poll(async () =>
          (await extensionTool.getPointerEvents())
            .filter((event) => event.phase !== 'move')
            .map((event) => event.phase)
        )
        .toEqual(['down', 'cancel'])
      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()
      expect(
        (await extensionTool.getPointerEvents())
          .filter((event) => event.phase !== 'move')
          .map((event) => event.phase)
      ).toEqual(['down', 'cancel'])
    })

    for (const { name, stop } of [
      {
        name: 'switching tools',
        stop: async (comfyPage: ComfyPage) => {
          await comfyPage.page
            .getByRole('button', {
              name: 'Alternate extension test tool',
              exact: true
            })
            .press('Enter')
        }
      },
      {
        name: 'unregistering the tool',
        stop: async (
          _comfyPage: ComfyPage,
          unregister: () => Promise<void>
        ) => {
          await unregister()
        }
      },
      {
        name: 'closing the editor',
        stop: async (comfyPage: ComfyPage) => {
          await comfyPage.page
            .getByRole('button', { name: 'Cancel', exact: true })
            .press('Enter')
        }
      }
    ]) {
      test(`${name} releases an active drag`, async ({
        comfyPage,
        extensionTool
      }) => {
        const { pointerId } = await extensionTool.startDrag()
        const pointerZone = await extensionTool.pointerZone.evaluateHandle(
          (zone) => zone
        )
        expect(
          await pointerZone.evaluate(
            (zone, id) => zone.hasPointerCapture(id),
            pointerId
          )
        ).toBe(true)
        await stop(comfyPage, () => extensionTool.unregister())
        await expect
          .poll(() =>
            pointerZone.evaluate(
              (zone, id) => zone.hasPointerCapture(id),
              pointerId
            )
          )
          .toBe(false)
        await expect
          .poll(() => extensionTool.getLifecycleCounts())
          .toEqual({ disposed: 1, unmounted: 1 })
        await comfyPage.page.mouse.up()
        await comfyPage.nextFrame()
        expect(
          (await extensionTool.getPointerEvents()).filter(
            (event) => event.phase === 'up'
          )
        ).toHaveLength(0)
      })
    }
  }
)
