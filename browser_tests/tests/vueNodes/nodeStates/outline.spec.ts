import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Vue Node selection outline',
  { tag: ['@vue-nodes', '@screenshot'] },
  () => {
    test('does not gain an extra focus outline when Shift is held on a selected node', async ({
      comfyPage
    }) => {
      test.info().annotations.push({
        type: 'regression',
        description:
          'Chromium paints a UA :focus-visible outline on a focused element after a bare Shift keypress; the LGraphNode root has tabindex="0", so a selected Vue node would otherwise gain a second outline. The selected-state class adds focus-visible:outline-none on the node root to suppress the UA outline, while leaving the focus ring intact for unselected (Tab-focused) nodes for keyboard a11y.'
      })

      await comfyPage.workflow.loadWorkflow('nodes/single_note')

      const note = comfyPage.vueNodes.getNodeByTitle('Note').first()
      await note.locator('.lg-node-header').click()
      await expect(note).toHaveClass(/outline-node-component-outline/)

      const box = await note.boundingBox()
      if (!box) throw new Error('Node bounding box not available')
      const PAD = 16
      const clip = {
        x: Math.max(0, Math.floor(box.x - PAD)),
        y: Math.max(0, Math.floor(box.y - PAD)),
        width: Math.ceil(box.width + PAD * 2),
        height: Math.ceil(box.height + PAD * 2)
      }

      await comfyPage.page.keyboard.down('Shift')
      await expect(comfyPage.page).toHaveScreenshot(
        'vue-node-shift-focus-outline.png',
        { clip }
      )
    })
  }
)
