import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../../fixtures/ComfyPage'
import type { ComfyPage } from '../../../../fixtures/ComfyPage'

test.describe('Textarea label overlap', { tag: ['@widget'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  const getFirstClipNode = (comfyPage: ComfyPage) =>
    comfyPage.vueNodes.getNodeByTitle('CLIP Text Encode (Prompt)').first()

  const getTextarea = (comfyPage: ComfyPage) =>
    getFirstClipNode(comfyPage).getByRole('textbox', { name: 'text' })

  test('label should have a background color to prevent text showing through when scrolled', async ({
    comfyPage
  }) => {
    const textarea = getTextarea(comfyPage)

    // Fill with enough lines to cause scrollable content
    const manyLines = Array.from(
      { length: 20 },
      (_, i) => `Line ${i + 1}`
    ).join('\n')
    await textarea.fill(manyLines)

    // The label associated with this textarea must have a non-transparent
    // background so scrolled text does not show through it.
    const bgColor = await textarea.evaluate((el) => {
      const label = (el as HTMLTextAreaElement).labels?.[0]
      return label ? getComputedStyle(label).backgroundColor : ''
    })

    // 'transparent' or 'rgba(0, 0, 0, 0)' means no background — the bug.
    expect(
      bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)',
      `Expected label to have a solid background color, but got "${bgColor}"`
    ).toBe(true)
  })
})
