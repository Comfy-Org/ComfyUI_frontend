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
    { tag: ['@screenshot', '@canvas'] },
    async ({ comfyPage, comfyMouse }) => {
      const textarea = getFirstMultilineStringWidget(comfyPage)
      await comfyMouse.mmbDragFromCenter(
        textarea,
        { dx: 120, dy: 80 },
        { steps: 10 }
      )

      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-nodes-paned-with-mmb-over-textarea.png'
      )
    }
  )

  test(
    'Middle-click drag on markdown widget should pan canvas',
    { tag: ['@screenshot', '@canvas'] },
    async ({ comfyPage, comfyMouse }) => {
      await comfyPage.workflow.loadWorkflow('nodes/note_nodes')

      // WidgetMarkdown.vue renders `.widget-markdown` as the outer wrapper;
      // the legacy `.comfy-markdown` class added by useMarkdownWidget only
      // exists on the unmounted DOM widget element, not in the Vue Nodes tree.
      const markdownWidget = comfyPage.page.locator('.widget-markdown').first()
      await comfyMouse.mmbDragFromCenter(
        markdownWidget,
        { dx: 120, dy: 80 },
        { steps: 10 }
      )

      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-nodes-paned-with-mmb-over-markdown.png'
      )
    }
  )
})
