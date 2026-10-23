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

  test('keeps paragraph breaks across a serialize and reload round-trip', async ({
    comfyPage
  }) => {
    const textarea = getFirstMultilineStringWidget(comfyPage)

    const paragraphs = [
      'First paragraph, ending in a space ',
      '',
      'Second paragraph',
      'still the second paragraph'
    ].join('\n')

    await textarea.fill(paragraphs)
    await expect(textarea).toHaveValue(paragraphs)

    const serialized = await comfyPage.workflow.getExportedWorkflow()
    await comfyPage.workflow.loadGraphData(serialized)
    await comfyPage.vueNodes.waitForNodes()

    await expect(getFirstMultilineStringWidget(comfyPage)).toHaveValue(
      paragraphs
    )
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

  test('keeps the text in place when the pointer moves onto it at a fractional zoom', async ({
    comfyPage
  }) => {
    const textarea = getFirstMultilineStringWidget(comfyPage)
    await textarea.fill(
      Array.from(
        { length: 30 },
        (_, i) => `Line ${i + 1} of a long prompt`
      ).join('\n')
    )
    await textarea.blur()
    await comfyPage.canvasOps.setScale(0.83)
    await comfyPage.canvasOps.moveMouseToEmptyArea()
    await comfyPage.canvasOps.waitForViewToSettle()
    const box = await textarea.boundingBox()
    if (!box) throw new Error('The textarea has no bounding box')
    const textOnly = {
      x: box.x + 2,
      y: box.y + 2,
      width: box.width - 4,
      height: box.height - 4
    }
    const atRest = await comfyPage.page.screenshot({ clip: textOnly })

    await textarea.hover()
    const hovered = await comfyPage.page.screenshot({ clip: textOnly })

    expect(hovered.equals(atRest), 'text moved when hovered').toBe(true)
  })

  test('should use native context menu when focused', async ({ comfyPage }) => {
    const textarea = getFirstMultilineStringWidget(comfyPage)
    const vueContextMenu = comfyPage.page.getByRole('menu')

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
