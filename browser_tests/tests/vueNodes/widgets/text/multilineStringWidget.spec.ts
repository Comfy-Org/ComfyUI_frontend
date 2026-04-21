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

  test(
    'Middle-click drag on textarea should pan canvas',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const textarea = getFirstMultilineStringWidget(comfyPage)
      await expect(textarea).toBeVisible()
      const box = await textarea.boundingBox()
      if (!box) throw new Error('Textarea bounding box not found')

      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      await comfyPage.canvasOps.middleClickDrag(center, {
        x: center.x + 120,
        y: center.y + 80
      })
      await comfyPage.nextFrame()

      await expect(comfyPage.canvas).toHaveScreenshot(
        'mmb-pan-through-textarea.png'
      )
    }
  )

  test(
    'Middle-click drag on markdown widget should pan canvas',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/note_nodes')

      const markdownWidget = comfyPage.page.locator('.comfy-markdown').first()
      await expect(markdownWidget).toBeVisible()

      const box = await markdownWidget.boundingBox()
      if (!box) throw new Error('Markdown widget bounding box not found')

      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      await comfyPage.canvasOps.middleClickDrag(center, {
        x: center.x + 120,
        y: center.y + 80
      })
      await comfyPage.nextFrame()

      await expect(comfyPage.canvas).toHaveScreenshot(
        'mmb-pan-through-markdown.png'
      )
    }
  )
})
