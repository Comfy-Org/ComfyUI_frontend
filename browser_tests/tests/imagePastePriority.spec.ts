import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Image paste priority over stale node metadata',
  { tag: ['@node'] },
  () => {
    test('Should not paste copied node when a LoadImage node is selected and clipboard has stale node metadata', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/load_image_with_ksampler')

      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()
      expect(initialCount).toBe(2)

      // Copy the KSampler node (puts data-metadata in clipboard)
      const ksamplerNodes =
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      await ksamplerNodes[0].copy()

      // Select the LoadImage node
      const loadImageNodes =
        await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
      await loadImageNodes[0].click('title')

      // Simulate pasting when clipboard has stale node metadata (text/html
      // with data-metadata) but no image file items. This replicates the bug
      // scenario: user copied a node, then copied a web image (which replaces
      // clipboard files but may leave stale text/html with node metadata).
      await comfyPage.page.evaluate(() => {
        const nodeData = { nodes: [{ type: 'KSampler', id: 99 }] }
        const base64 = btoa(JSON.stringify(nodeData))
        const html =
          '<meta charset="utf-8"><div><span data-metadata="' +
          base64 +
          '"></span></div><span style="white-space:pre-wrap;">Text</span>'

        const dataTransfer = new DataTransfer()
        dataTransfer.setData('text/html', html)

        const event = new ClipboardEvent('paste', {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true
        })
        document.dispatchEvent(event)
      })

      await comfyPage.nextFrame()

      // Node count should remain the same — stale node metadata should NOT
      // be deserialized when a media node is selected.
      const finalCount = await comfyPage.nodeOps.getGraphNodesCount()
      expect(finalCount).toBe(initialCount)
    })
  }
)
