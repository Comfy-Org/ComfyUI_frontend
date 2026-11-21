import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Note Node API Export', { tag: '@node' }, () => {
  test('filters virtual nodes from API export and preserves them in workflow export', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/note_with_ksampler')

    const apiWorkflow = await comfyPage.workflow.getExportedWorkflow({
      api: true
    })

    const entries = Object.values(apiWorkflow)
    expect(entries, 'Exactly one real node in API output').toHaveLength(1)
    expect(entries[0].class_type).toBe('KSampler')

    const workflow = await comfyPage.workflow.getExportedWorkflow()

    const noteNodes = workflow.nodes.filter(
      (n) => n.type === 'Note' || n.type === 'MarkdownNote'
    )
    expect(
      noteNodes.map((node) => node.type).sort(),
      'Standard export must preserve both Note and MarkdownNote'
    ).toEqual(['MarkdownNote', 'Note'])
  })
})
