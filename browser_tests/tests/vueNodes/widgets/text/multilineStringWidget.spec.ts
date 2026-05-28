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

  test.describe('wheel scroll boundary', () => {
    async function fillScrollable(
      textarea: ReturnType<typeof getFirstMultilineStringWidget>
    ) {
      await textarea.fill(
        Array.from({ length: 50 }, () => 'Lorem ipsum dolor sit amet').join(
          '\n'
        )
      )
      await expect
        .poll(() =>
          textarea.evaluate((el) => el.scrollHeight > el.clientHeight)
        )
        .toBe(true)
    }

    test('does not zoom canvas when scrolling mid-content', async ({
      comfyPage
    }) => {
      const textarea = getFirstMultilineStringWidget(comfyPage)
      await fillScrollable(textarea)
      await textarea.evaluate((el) => {
        el.scrollTop = Math.floor((el.scrollHeight - el.clientHeight) / 2)
      })

      const scaleBefore = await comfyPage.canvasOps.getScale()
      const box = await textarea.boundingBox()
      if (!box) throw new Error('textarea has no bounding box')
      await comfyPage.page.mouse.move(
        box.x + box.width / 2,
        box.y + box.height / 2
      )
      await comfyPage.page.mouse.wheel(0, 120)
      await comfyPage.nextFrame()

      expect(await comfyPage.canvasOps.getScale()).toBeCloseTo(scaleBefore, 3)
    })

    test('passes wheel through to canvas at the bottom boundary', async ({
      comfyPage
    }) => {
      const textarea = getFirstMultilineStringWidget(comfyPage)
      await fillScrollable(textarea)
      await textarea.evaluate((el) => {
        el.scrollTop = el.scrollHeight
      })

      const scaleBefore = await comfyPage.canvasOps.getScale()
      const box = await textarea.boundingBox()
      if (!box) throw new Error('textarea has no bounding box')
      await comfyPage.page.mouse.move(
        box.x + box.width / 2,
        box.y + box.height / 2
      )
      await comfyPage.page.mouse.wheel(0, 120)
      await expect
        .poll(() => comfyPage.canvasOps.getScale())
        .not.toBeCloseTo(scaleBefore, 3)
    })
  })
})
