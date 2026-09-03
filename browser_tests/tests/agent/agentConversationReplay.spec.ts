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

  test.describe('recorded agent-rec-text-only-answer', () => {
    test.use({ conversationCase: 'agent-rec-text-only-answer' })

    test('switches to the seeded tab and answers in text without touching the graph', async ({
      agentConversation
    }) => {
      test.setTimeout(45_000)
      const { panel } = agentConversation

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()

      // A passing group collapses at turn end; the header count is the only
      // stable part of its name (the duration is the recording's).
      const toolGroup = panel.getByRole('button', { name: /^Ran 2 tool calls/ })
      await expect(toolGroup).toBeVisible()
      await expect(toolGroup).toHaveAttribute('aria-expanded', 'false')
      await toolGroup.click()
      const toolRows = panel.getByRole('listitem')
      await expect(toolRows.filter({ hasText: 'Switched tabs' })).toBeVisible()
      await expect(toolRows.filter({ hasText: 'Print workflow' })).toBeVisible()

      await expect(
        panel.getByRole('button', { name: 'Open Text to image' })
      ).toBeVisible()
      // An assistant text part rendered; the model prose itself is never pinned.
      await expect(panel.getByTestId('markdown-stream').first()).not.toBeEmpty()
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        'connected'
      )
      // Zero graph_ops entries: the catch-up is the one applied update.
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        '1 updates'
      )

      // The seed is untouched: five nodes with the seed's own wiring.
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
          { id: '9', title: 'SaveImage', inputs: [true], outputs: [] }
        ])
    })
  })

  test.describe('recorded agent-rec-tool-error', () => {
    test.use({ conversationCase: 'agent-rec-tool-error' })

    test('keeps a failed add_node group open and leaves the graph untouched', async ({
      agentConversation
    }) => {
      test.setTimeout(45_000)
      const { panel } = agentConversation

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()

      // The failed group stays open at turn end: its rows are visible with NO
      // expand click, and aria-expanded is read off the group's trigger button.
      const toolRows = panel.getByRole('listitem')
      await expect(toolRows.filter({ hasText: 'Add node' })).toBeVisible()
      await expect(toolRows.filter({ hasText: 'Switched tabs' })).toBeVisible()
      await expect(
        panel.getByRole('button', { name: /^Ran 2 tool calls/ })
      ).toHaveAttribute('aria-expanded', 'true')

      await expect(
        panel.getByRole('button', { name: 'Open Text to image' })
      ).toBeVisible()
      await expect(panel.getByTestId('markdown-stream').first()).not.toBeEmpty()
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        'connected'
      )
      // Zero graph_ops entries: the catch-up is the one applied update.
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        '1 updates'
      )

      // No new node: the seed's five nodes with the seed's own wiring.
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
          { id: '9', title: 'SaveImage', inputs: [true], outputs: [] }
        ])
    })
  })

  test.describe('recorded agent-rec-string-node-into-prompt', () => {
    test.use({ conversationCase: 'agent-rec-string-node-into-prompt' })

    test('adds a recorded string node, sets its text, and wires it into the positive prompt', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(45_000)
      const { panel } = agentConversation

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()

      const toolGroup = panel.getByRole('button', { name: /^Ran 5 tool calls/ })
      await expect(toolGroup).toBeVisible()
      await expect(toolGroup).toHaveAttribute('aria-expanded', 'false')
      await toolGroup.click()
      const toolRows = panel.getByRole('listitem')
      await expect(toolRows).toHaveCount(5)
      await expect(toolRows.filter({ hasText: 'Switched tabs' })).toBeVisible()
      await expect(toolRows.filter({ hasText: 'Show node' })).toBeVisible()
      await expect(toolRows.filter({ hasText: 'Apply ops' })).toBeVisible()

      await expect(
        panel.getByRole('button', { name: 'Open Text to image' })
      ).toBeVisible()
      await expect(panel.getByTestId('markdown-stream').first()).not.toBeEmpty()
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        'connected'
      )
      // One graph_ops entry (add_node + set_widget + connect) plus the catch-up.
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        '2 updates'
      )

      // The recorded node id, its text widget value on the unfiltered DOM.
      const stringNode = page.locator('[data-node-id="1896929324796827"]')
      await expect(stringNode).toBeVisible()
      await expect(stringNode.getByLabel('value', { exact: true })).toHaveValue(
        'a photo of a pier at sunset'
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
          {
            id: '1896929324796827',
            title: 'PrimitiveStringMultiline',
            inputs: [],
            outputs: [true]
          }
        ])
    })
  })

  test.describe('recorded agent-rec-second-prompt-encoder', () => {
    test.use({ conversationCase: 'agent-rec-second-prompt-encoder' })

    test('adds a recorded second encoder wired from CLIP into the negative input', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(45_000)
      const { panel } = agentConversation

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()

      // The recording's closing `validate` call errored (the seed's checkpoint
      // is not installed on the recording host), so the group is a failed one:
      // it stays open at turn end and its rows are visible with NO click.
      const toolRows = panel.getByRole('listitem')
      await expect(toolRows.filter({ hasText: 'Switched tabs' })).toBeVisible()
      await expect(toolRows.filter({ hasText: 'Apply ops' })).toBeVisible()
      await expect(toolRows.filter({ hasText: 'Validate' })).toBeVisible()
      await expect(
        panel.getByRole('button', { name: /^Ran 5 tool calls/ })
      ).toHaveAttribute('aria-expanded', 'true')

      await expect(
        panel.getByRole('button', { name: 'Open Text to image' })
      ).toBeVisible()
      await expect(panel.getByTestId('markdown-stream').first()).not.toBeEmpty()
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        'connected'
      )
      // One graph_ops entry (add_node + set_widget + connect x2) plus the catch-up.
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        '2 updates'
      )
      await expect(
        page.locator('[data-node-id="2904574201837211"]')
      ).toBeVisible()

      // The sampler's negative input (index 2) flips false -> true; the new
      // encoder is wired on both sides.
      await expect
        .poll(() => agentConversation.graphSnapshot())
        .toEqual([
          {
            id: '3',
            title: 'KSampler',
            inputs: [true, true, true, false],
            outputs: [true]
          },
          {
            id: '4',
            title: 'CheckpointLoaderSimple',
            inputs: [],
            outputs: [true, true, true]
          },
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
          {
            id: '2904574201837211',
            title: 'CLIPTextEncode',
            inputs: [true],
            outputs: [true]
          }
        ])
    })
  })

  test.describe('recorded agent-rec-set-widget-existing', () => {
    test.use({ conversationCase: 'agent-rec-set-widget-existing' })

    test('applies recorded set_widget ops to an existing node and adds nothing', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(45_000)
      const { panel } = agentConversation

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()

      const toolGroup = panel.getByRole('button', { name: /^Ran 4 tool calls/ })
      await expect(toolGroup).toBeVisible()
      await expect(toolGroup).toHaveAttribute('aria-expanded', 'false')
      await toolGroup.click()
      const toolRows = panel.getByRole('listitem')
      await expect(toolRows).toHaveCount(4)
      await expect(toolRows.filter({ hasText: 'Apply ops' })).toBeVisible()
      await expect(toolRows.filter({ hasText: 'List slots' })).toBeVisible()

      await expect(panel.getByTestId('markdown-stream').first()).not.toBeEmpty()
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        'connected'
      )
      // One graph_ops entry (two set_widget ops) plus the catch-up.
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        '2 updates'
      )

      // The widget values on the unfiltered DOM: the aria-label sits on the
      // number widget's container, so descend to its input.
      const sampler = page.locator('[data-node-id="3"]')
      await expect(
        sampler.getByLabel('steps', { exact: true }).locator('input')
      ).toHaveValue('30')
      await expect(
        sampler.getByLabel('cfg', { exact: true }).locator('input')
      ).toHaveValue('5')

      // No node added or removed: the seed's five, wired as seeded.
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
          { id: '9', title: 'SaveImage', inputs: [true], outputs: [] }
        ])
    })
  })

  test.describe('recorded agent-rec-replace-prompt-encoder', () => {
    test.use({ conversationCase: 'agent-rec-replace-prompt-encoder' })

    test('deletes the recorded prompt node and rewires a fresh encoder in its place', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(45_000)
      const { panel } = agentConversation

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()

      // The recording's closing `validate` errored on the host's missing
      // checkpoint, so the group stays open: rows are visible with NO click.
      const toolRows = panel.getByRole('listitem')
      await expect(toolRows.filter({ hasText: 'Delete node' })).toBeVisible()
      await expect(toolRows.filter({ hasText: 'Apply ops' })).toBeVisible()
      await expect(
        panel.getByRole('button', { name: /^Ran 6 tool calls/ })
      ).toHaveAttribute('aria-expanded', 'true')

      await expect(panel.getByTestId('markdown-stream').first()).not.toBeEmpty()
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        'connected'
      )
      // Two graph_ops entries (the delete, then the add + wiring) plus the catch-up.
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        '3 updates'
      )

      // The deleted node is gone from the unfiltered DOM, not merely filtered
      // out of the snapshot.
      await expect(page.locator('[data-node-id="6"]')).toHaveCount(0)
      await expect(
        page.locator('[data-node-id="4073815636872683"]')
      ).toBeVisible()

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
          {
            id: '8',
            title: 'VAEDecode',
            inputs: [true, true],
            outputs: [true]
          },
          { id: '9', title: 'SaveImage', inputs: [true], outputs: [] },
          {
            id: '4073815636872683',
            title: 'CLIPTextEncode',
            inputs: [true],
            outputs: [true]
          }
        ])
    })
  })

  test.describe('recorded agent-rec-refiner-between', () => {
    test.use({ conversationCase: 'agent-rec-refiner-between' })

    test('adds a recorded refiner sampler between the first sampler and the decoder', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(45_000)
      const { panel } = agentConversation

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()

      // The recording's closing `validate` errored on the host's missing
      // checkpoint, so the group stays open: rows visible with NO click.
      const toolRows = panel.getByRole('listitem')
      await expect(toolRows.filter({ hasText: 'Apply ops' })).toBeVisible()
      await expect(
        panel.getByRole('button', { name: /^Ran 5 tool calls/ })
      ).toHaveAttribute('aria-expanded', 'true')

      await expect(panel.getByTestId('markdown-stream').first()).not.toBeEmpty()
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        'connected'
      )
      // One graph_ops entry (add + four connects + three set_widget) plus the catch-up.
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        '2 updates'
      )
      await expect(
        page.locator('[data-node-id="2629930598730104"]')
      ).toBeVisible()

      // The refiner is wired on both sides: its latent_image input (index 3)
      // takes the first sampler, and its own LATENT output feeds the decoder,
      // whose samples input keeps its connection by last-writer-wins.
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
          {
            id: '2629930598730104',
            title: 'KSampler',
            inputs: [true, true, false, true],
            outputs: [true]
          }
        ])
    })
  })

  test.describe('recorded agent-rec-batched-ops', () => {
    test.use({ conversationCase: 'agent-rec-batched-ops' })

    test('applies two recorded adds and two connects as one batched entry', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(45_000)
      const { panel } = agentConversation

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()

      const toolGroup = panel.getByRole('button', { name: /^Ran 3 tool calls/ })
      await expect(toolGroup).toBeVisible()
      await expect(toolGroup).toHaveAttribute('aria-expanded', 'false')
      await toolGroup.click()
      const toolRows = panel.getByRole('listitem')
      await expect(toolRows).toHaveCount(3)
      // One apply call, so its row carries no coalescing badge: two adjacent
      // apply calls would render as a single "Apply ops" row with "x2".
      const applyRow = toolRows.filter({ hasText: 'Apply ops' })
      await expect(applyRow).toHaveCount(1)
      // The coalescing badge renders as a leading multiplication sign
      // (ToolCallCard.vue renders it only when count > 1).
      await expect(applyRow).not.toContainText('\u00d7')

      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        'connected'
      )
      // ONE graph_ops entry for all four ops, plus the catch-up: two unbatched
      // apply calls would read "3 updates".
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        '2 updates'
      )

      await expect(
        page.locator('[data-node-id="3495500264284537"]')
      ).toBeVisible()
      await expect(
        page.locator('[data-node-id="4454558117922341"]')
      ).toBeVisible()

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
          {
            id: '3495500264284537',
            title: 'CLIPTextEncode',
            inputs: [true],
            outputs: [false]
          },
          {
            id: '4454558117922341',
            title: 'CLIPTextEncode',
            inputs: [true],
            outputs: [false]
          }
        ])
    })
  })

  // The two eval-suite cases, re-recorded on the local agent (the committed
  // synthesized fixtures above stay as they are). The recorded prompt is the
  // eval prompt behind the tab switch the replay binds on.
  test.describe('recorded agent-rec-workflow-editing-05', () => {
    test.use({ conversationCase: 'agent-rec-workflow-editing-05' })

    test('stitches the recorded output beside the input and routes it to the save', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(45_000)
      const { panel } = agentConversation

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()

      const toolGroup = panel.getByRole('button', { name: /^Ran 7 tool calls/ })
      await expect(toolGroup).toBeVisible()
      await expect(toolGroup).toHaveAttribute('aria-expanded', 'false')
      await toolGroup.click()
      const toolRows = panel.getByRole('listitem')
      await expect(toolRows).toHaveCount(7)
      await expect(toolRows.filter({ hasText: 'Switched tabs' })).toBeVisible()
      await expect(toolRows.filter({ hasText: 'Apply ops' })).toBeVisible()
      await expect(toolRows.filter({ hasText: 'List slots' })).toBeVisible()

      await expect(
        panel.getByRole('button', { name: 'Open Image edit' })
      ).toBeVisible()
      await expect(panel.getByTestId('markdown-stream').first()).not.toBeEmpty()
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        'connected'
      )
      // Two graph_ops entries (apply_ops, then the follow-up connect) plus the
      // catch-up.
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        '3 updates'
      )
      await expect(
        page.locator('[data-node-id="1380502390045812"]')
      ).toBeVisible()

      // The stitch takes the source image and the decoded image; its output
      // replaces the decoder's link into the save node (one link per input).
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
            id: '1380502390045812',
            title: 'ImageStitch',
            inputs: [true, true],
            outputs: [true]
          }
        ])
    })
  })

  test.describe('recorded agent-rec-zimage-string-node-prompt', () => {
    test.use({ conversationCase: 'agent-rec-zimage-string-node-prompt' })

    test('adds the recorded text node and the inputs the sampler was missing', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(45_000)
      const { panel } = agentConversation

      await agentConversation.sendPrompt()
      await agentConversation.replayResponse()
      await agentConversation.waitForTurnComplete()

      // The recording's `validate` and `list_model_picks` calls errored (no
      // checkpoint on the recording host), so the group stays open at turn end.
      const toolRows = panel.getByRole('listitem')
      await expect(toolRows.filter({ hasText: 'Switched tabs' })).toBeVisible()
      await expect(toolRows.filter({ hasText: 'Apply ops' })).toBeVisible()
      await expect(toolRows.filter({ hasText: 'Validate' })).toBeVisible()
      await expect(
        panel.getByRole('button', { name: /^Ran 9 tool calls/ })
      ).toHaveAttribute('aria-expanded', 'true')

      await expect(
        panel.getByRole('button', { name: 'Open Text to image' })
      ).toBeVisible()
      await expect(panel.getByTestId('markdown-stream').first()).not.toBeEmpty()
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        'connected'
      )
      // One graph_ops entry (nine ops) plus the catch-up.
      await expect(panel.getByTestId('agent-crdt-status')).toContainText(
        '2 updates'
      )
      const stringNode = page.locator('[data-node-id="2346297545678642"]')
      await expect(stringNode).toBeVisible()
      await expect(stringNode.getByLabel('value', { exact: true })).toHaveValue(
        'a red bicycle on a pier at dusk'
      )

      // Every sampler input is now fed: the recorded turn also added a
      // negative encoder and an empty latent.
      await expect
        .poll(() => agentConversation.graphSnapshot())
        .toEqual([
          {
            id: '3',
            title: 'KSampler',
            inputs: [true, true, true, true],
            outputs: [true]
          },
          {
            id: '4',
            title: 'CheckpointLoaderSimple',
            inputs: [],
            outputs: [true, true, true]
          },
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
          // graphSnapshot sorts nodes by numeric id.
          {
            id: '1068057559864246',
            title: 'CLIPTextEncode',
            inputs: [true],
            outputs: [true]
          },
          {
            id: '2346297545678642',
            title: 'PrimitiveStringMultiline',
            inputs: [],
            outputs: [true]
          },
          {
            id: '4476795995918869',
            title: 'EmptyLatentImage',
            inputs: [],
            outputs: [true]
          }
        ])
    })
  })
})
