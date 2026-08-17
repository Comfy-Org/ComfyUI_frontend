import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Vue Multiline String Widget', { tag: '@vue-nodes' }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

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

  test('hides a linked core prompt without changing node geometry', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('widgets/linked_multiline_string')

    const clipNode = getFirstClipNode(comfyPage)
    const placeholder = clipNode.getByTestId(TestIds.widgets.linkedPlaceholder)
    const linkedContent = clipNode.getByTestId(TestIds.widgets.linkedContent)
    const hiddenTextarea = clipNode.locator('textarea')
    const nodeBounds = await clipNode.boundingBox()

    await expect(placeholder).toHaveAttribute(
      'data-linked-display',
      'expanding'
    )
    await expect(placeholder).toHaveAccessibleName('text: Linked input')
    await expect(linkedContent).toHaveAttribute('inert', '')
    await expect(linkedContent).toHaveAttribute('aria-hidden', 'true')
    await expect(hiddenTextarea).toBeHidden()
    await expect(hiddenTextarea).toBeDisabled()
    await expect(clipNode.getByRole('textbox', { name: 'text' })).toHaveCount(0)
    await expect(hiddenTextarea).toHaveValue('stale local prompt')

    await hiddenTextarea.evaluate((element) => element.focus())
    await expect
      .poll(() =>
        hiddenTextarea.evaluate((element) => document.activeElement === element)
      )
      .toBe(false)

    const [clipNodeRef] =
      await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
    if (!clipNodeRef || !nodeBounds) {
      throw new Error('Linked CLIPTextEncode node did not render')
    }
    const textInput = await clipNodeRef.getInput(1)
    await textInput.removeLinks()
    await comfyPage.nextFrame()

    await expect(placeholder).toHaveCount(0)
    const restoredTextarea = getFirstMultilineStringWidget(comfyPage)
    await expect(restoredTextarea).toBeVisible()
    await expect(restoredTextarea).toHaveValue('stale local prompt')
    await restoredTextarea.fill('restored local prompt')
    await expect(restoredTextarea).toHaveValue('restored local prompt')
    await expect
      .poll(async () => (await clipNode.boundingBox())?.height)
      .toBeCloseTo(nodeBounds.height, 0)
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
    { tag: ['@canvas', '@widget'] },
    async ({ comfyPage, comfyMouse }) => {
      const textarea = getFirstMultilineStringWidget(comfyPage)
      const offsetBefore = await comfyPage.canvasOps.getOffset()

      await comfyMouse.middleDragFromCenter(
        textarea,
        { x: 140, y: 90 },
        { steps: 10 }
      )

      await expect
        .poll(() => comfyPage.canvasOps.getOffset())
        .not.toEqual(offsetBefore)
    }
  )
})
