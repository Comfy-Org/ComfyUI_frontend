import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

test.describe('Agent conversation replay', { tag: '@cloud' }, () => {
  test.describe('evals agent-l4-zimage-string-node-prompt', () => {
    test.use({ conversationCase: 'agent-l4-zimage-string-node-prompt' })

    test('adds a string node, sets its text, and wires it into the prompt', async ({
      agentConversation
    }) => {
      test.setTimeout(45_000)
      const { panel } = agentConversation

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()

      const toolGroup = panel.getByRole('button', {
        name: 'Ran 3 tool calls for 0.9 seconds'
      })
      await expect(toolGroup).toBeVisible()
      await expect(toolGroup).toHaveAttribute('aria-expanded', 'false')
      await toolGroup.click()
      const toolRows = panel.getByRole('listitem')
      await expect(toolRows).toHaveCount(3)
      await expect(toolRows.filter({ hasText: 'Add node' })).toBeVisible()
      await expect(toolRows.filter({ hasText: 'Set widget' })).toBeVisible()
      await expect(toolRows.filter({ hasText: 'Connect' })).toBeVisible()

      await expect(
        panel.getByRole('button', { name: 'Open Text to image' })
      ).toBeVisible()
      await expect(
        panel.locator('strong', { hasText: 'Prompt text' })
      ).toBeVisible()
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        'connected'
      )
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        '4 updates'
      )

      await expect
        .poll(() => agentConversation.graphSnapshot())
        .toEqual([
          {
            id: '3',
            title: 'KSampler',
            inputs: [true, true, false, false],
            outputs: [true]
          },
          {
            id: '4',
            title: 'CheckpointLoaderSimple',
            inputs: [],
            outputs: [true, true, true]
          },
          // The wired `text` input is widget-backed and renders as a widget,
          // not a slot row; the link shows on the string node's output.
          {
            id: '6',
            title: 'Positive prompt',
            inputs: [true],
            outputs: [true]
          },
          {
            id: '8',
            title: 'VAEDecode',
            inputs: [true, true],
            outputs: [true]
          },
          { id: '9', title: 'SaveImage', inputs: [true], outputs: [] },
          { id: '10', title: 'Prompt text', inputs: [], outputs: [true] }
        ])
    })
  })

  test.describe('evals agent-workflow-editing-05', () => {
    test.use({ conversationCase: 'agent-workflow-editing-05' })

    test('stitches the input next to the output and previews the pair', async ({
      agentConversation
    }) => {
      test.setTimeout(45_000)
      const { panel } = agentConversation

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()

      const toolGroup = panel.getByRole('button', {
        name: 'Ran 2 tool calls for 1.2 seconds'
      })
      await expect(toolGroup).toBeVisible()
      await expect(toolGroup).toHaveAttribute('aria-expanded', 'false')
      await expect(
        panel.locator('strong', { hasText: 'Image Stitch' })
      ).toBeVisible()
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        '3 updates'
      )

      await expect
        .poll(() => agentConversation.graphSnapshot())
        .toEqual([
          { id: '1', title: 'LoadImage', inputs: [], outputs: [true, false] },
          {
            id: '2',
            title: 'VAEEncode',
            inputs: [true, false],
            outputs: [true]
          },
          {
            id: '3',
            title: 'KSampler',
            inputs: [false, false, false, true],
            outputs: [true]
          },
          {
            id: '8',
            title: 'VAEDecode',
            inputs: [true, false],
            outputs: [true]
          },
          { id: '9', title: 'SaveImage', inputs: [true], outputs: [] },
          {
            id: '12',
            title: 'Input vs output',
            inputs: [true, true],
            outputs: [true]
          },
          { id: '13', title: 'Side by side', inputs: [true], outputs: [] }
        ])
    })
  })
})
