import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('Preview as Text node', () => {
  test('does not include preview widget values in the API prompt', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      const node = window.LiteGraph!.createNode('PreviewAny')!
      node.pos = [500, 200]
      window.app!.graph.add(node)
    })

    // Simulate a previous execution: backend returned text and the frontend
    // populated the preview widget values. The next prompt submission must
    // NOT echo those values back as inputs (which would change the cache
    // signature and trigger a redundant re-execution).
    await comfyPage.page.evaluate(() => {
      const node = window.app!.graph.nodes.find((n) => n.type === 'PreviewAny')!
      for (const widget of node.widgets ?? []) {
        if (widget.name?.startsWith('preview_')) {
          widget.value = 'rendered preview content from previous execution'
        }
      }
    })

    const apiWorkflow = await comfyPage.workflow.getExportedWorkflow({
      api: true
    })

    const previewEntry = Object.values(apiWorkflow).find(
      (n) => n.class_type === 'PreviewAny'
    )
    expect(previewEntry).toBeDefined()

    expect(previewEntry!.inputs).not.toHaveProperty('preview_markdown')
    expect(previewEntry!.inputs).not.toHaveProperty('preview_text')
    expect(previewEntry!.inputs).not.toHaveProperty('previewMode')
  })
})
