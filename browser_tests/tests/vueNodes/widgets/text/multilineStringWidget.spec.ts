import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

test.describe('Vue Multiline String Widget', { tag: '@vue-nodes' }, () => {
  const getFirstClipNode = (comfyPage: ComfyPage) =>
    comfyPage.vueNodes.getNodeByTitle('CLIP Text Encode (Prompt)').first()

  const getFirstMultilineStringWidget = (comfyPage: ComfyPage) =>
    getFirstClipNode(comfyPage).getByRole('textbox', { name: 'text' })

  const getCanvasOffset = (comfyPage: ComfyPage) =>
    comfyPage.page.evaluate(() => {
      const ds = window.app!.canvas!.ds
      return [ds.offset[0], ds.offset[1]]
    })

  test('should allow entering text', async ({ comfyPage }) => {
    const textarea = getFirstMultilineStringWidget(comfyPage)
    await textarea.fill('Hello World')
    await expect(textarea).toHaveValue('Hello World')
    await textarea.fill('Hello World 2')
    await expect(textarea).toHaveValue('Hello World 2')
  })

  test('should support entering multiline content', async ({ comfyPage }) => {
    const textarea = getFirstMultilineStringWidget(comfyPage)

    const multilineValue = ['Line 1', 'Line 2', 'Line 3'].join('\n')

    await textarea.fill(multilineValue)
    await expect(textarea).toHaveValue(multilineValue)
  })

  test('should retain value after focus changes', async ({ comfyPage }) => {
    const textarea = getFirstMultilineStringWidget(comfyPage)

    await textarea.fill('Keep me around')

    // Click another node
    const loadCheckpointNode =
      comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
    await loadCheckpointNode.click()
    await getFirstClipNode(comfyPage).click()

    await expect(textarea).toHaveValue('Keep me around')
  })

  test('should use native context menu when focused', async ({ comfyPage }) => {
    const textarea = getFirstMultilineStringWidget(comfyPage)
    const vueContextMenu = comfyPage.page.locator('.p-contextmenu')

    await textarea.focus()
    await textarea.click({ button: 'right' })
    await expect(vueContextMenu).toBeHidden()
    await textarea.blur()

    await textarea.click({ button: 'right' })
    await expect(vueContextMenu).toBeVisible()
  })

  test('Middle-click drag on textarea should pan canvas', async ({
    comfyPage
  }) => {
    const textarea = getFirstMultilineStringWidget(comfyPage)
    const textareaBounds = await textarea.boundingBox()
    if (!textareaBounds) throw new Error('Textarea bounding box not found')

    const start = {
      x: textareaBounds.x + textareaBounds.width / 2,
      y: textareaBounds.y + textareaBounds.height / 2
    }

    const offsetBefore = await getCanvasOffset(comfyPage)

    await comfyPage.page.mouse.move(start.x, start.y)
    await comfyPage.page.mouse.down({ button: 'middle' })
    await comfyPage.page.mouse.move(start.x + 120, start.y + 80, { steps: 10 })
    await comfyPage.page.mouse.up({ button: 'middle' })
    await comfyPage.nextFrame()

    await expect
      .poll(() => getCanvasOffset(comfyPage))
      .not.toEqual(offsetBefore)
  })

  test('Middle-click drag on markdown widget should pan canvas', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/note_nodes')

    const markdownWidget = comfyPage.page.locator('.comfy-markdown').first()
    await expect(markdownWidget).toBeVisible()

    const markdownBounds = await markdownWidget.boundingBox()
    if (!markdownBounds)
      throw new Error('Markdown widget bounding box not found')

    const start = {
      x: markdownBounds.x + markdownBounds.width / 2,
      y: markdownBounds.y + markdownBounds.height / 2
    }

    const offsetBefore = await getCanvasOffset(comfyPage)

    await comfyPage.page.mouse.move(start.x, start.y)
    await comfyPage.page.mouse.down({ button: 'middle' })
    await comfyPage.page.mouse.move(start.x + 120, start.y + 80, { steps: 10 })
    await comfyPage.page.mouse.up({ button: 'middle' })
    await comfyPage.nextFrame()

    await expect
      .poll(() => getCanvasOffset(comfyPage))
      .not.toEqual(offsetBefore)
  })
})
