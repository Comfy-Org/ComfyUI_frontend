import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Note Node API Export', { tag: '@node' }, () => {
  test('excludes Note and MarkdownNote from API format export', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/note_nodes')

    const apiWorkflow = await comfyPage.workflow.getExportedWorkflow({
      api: true
    })

    const classTypes = Object.values(apiWorkflow).map((n) => n.class_type)
    expect(classTypes, 'API output should not contain Note').not.toContain(
      'Note'
    )
    expect(
      classTypes,
      'API output should not contain MarkdownNote'
    ).not.toContain('MarkdownNote')
    expect(
      Object.keys(apiWorkflow),
      'All-virtual workflow should produce empty API output'
    ).toHaveLength(0)
  })

  test('preserves real nodes while filtering virtual ones', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/note_with_ksampler')

    const apiWorkflow = await comfyPage.workflow.getExportedWorkflow({
      api: true
    })

    const entries = Object.values(apiWorkflow)
    expect(entries, 'Exactly one real node in API output').toHaveLength(1)
    expect(entries[0].class_type).toBe('KSampler')
  })

  test('standard workflow export still includes Note nodes', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/note_nodes')

    const workflow = await comfyPage.workflow.getExportedWorkflow()

    const noteNodes = workflow.nodes.filter(
      (n) => n.type === 'Note' || n.type === 'MarkdownNote'
    )
    expect(
      noteNodes,
      'Standard export must preserve both Note and MarkdownNote'
    ).toHaveLength(2)
  })

  test('no virtual node types leak through graphToPrompt', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/note_with_ksampler')

    const virtualNodeCheck = await comfyPage.page.evaluate(async () => {
      const { output } = await window.app!.graphToPrompt()
      const virtualTypes = ['Note', 'MarkdownNote', 'Reroute', 'PrimitiveNode']
      const leaked: string[] = []
      for (const node of Object.values(output)) {
        if (virtualTypes.includes(node.class_type)) {
          leaked.push(node.class_type)
        }
      }
      return { leaked, totalNodes: Object.keys(output).length }
    })

    expect(
      virtualNodeCheck.leaked,
      'No virtual node types should leak into API output'
    ).toHaveLength(0)
    expect(virtualNodeCheck.totalNodes).toBeGreaterThan(0)
  })
})
