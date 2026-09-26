import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import { toTurnId } from '../../../schemas/agentApiSchema'
import type { AssistantMessage } from '../../../services/agent/agentMessageParts'

import AgentMessage from './AgentMessage.vue'

// PM-1135 / PM-1313 regressions across a tool-call split, at the AgentMessage
// render level (see agentMessageGroup.ts for the grouping logic itself):
// bare assets should coalesce into one grid, captioned assets should keep
// their order and pairing.
function fragmentedCaptionedAssetsMessage(): AssistantMessage {
  return {
    id: toTurnId('msg-assets'),
    role: 'assistant',
    streaming: false,
    thinking: false,
    parts: [
      {
        type: 'text',
        text: 'Version A:\n\n![i1.png](https://x/i1.png)',
        state: 'done'
      },
      {
        type: 'tool',
        callId: 'tool_0',
        name: 'preview_image',
        state: 'done'
      },
      {
        type: 'text',
        text: 'Version B:\n\n![i2.png](https://x/i2.png)',
        state: 'done'
      }
    ]
  }
}

describe('AgentMessage asset grid fragmentation', () => {
  it('PM-1135: keeps each caption paired with its own asset, in order, across a tool-call split', () => {
    render(AgentMessage, {
      props: { message: fragmentedCaptionedAssetsMessage() },
      global: { plugins: [i18n] }
    })

    const groups = screen.getAllByTestId('reply-asset-group')
    expect(groups).toHaveLength(2)
    expect(
      within(groups[0]).getByRole('img', { name: 'i1.png' })
    ).toBeInTheDocument()
    expect(
      within(groups[1]).getByRole('img', { name: 'i2.png' })
    ).toBeInTheDocument()

    // Each caption sits directly beside its own asset group, in the
    // original order, not both captions floated above a merged gallery.
    const versionA = screen.getByText('Version A:')
    const versionB = screen.getByText('Version B:')
    expect(
      versionA.compareDocumentPosition(groups[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      groups[0].compareDocumentPosition(versionB) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      versionB.compareDocumentPosition(groups[1]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('PM-1135: coalesces two bare, uncaptioned assets split by a tool call into one grid', () => {
    const message: AssistantMessage = {
      id: toTurnId('msg-bare-assets'),
      role: 'assistant',
      streaming: false,
      thinking: false,
      parts: [
        {
          type: 'text',
          text: '![i1.png](https://x/i1.png)',
          state: 'done'
        },
        {
          type: 'tool',
          callId: 'tool_0',
          name: 'preview_image',
          state: 'done'
        },
        {
          type: 'text',
          text: '![i2.png](https://x/i2.png)',
          state: 'done'
        }
      ]
    }

    render(AgentMessage, {
      props: { message },
      global: { plugins: [i18n] }
    })

    const groups = screen.getAllByTestId('reply-asset-group')
    expect(groups).toHaveLength(1)
    expect(
      within(groups[0]).getByRole('img', { name: 'i1.png' })
    ).toBeInTheDocument()
    expect(
      within(groups[0]).getByRole('img', { name: 'i2.png' })
    ).toBeInTheDocument()
  })

  it('PM-1135: puts a bare asset before later, unrelated prose', () => {
    const message: AssistantMessage = {
      id: toTurnId('msg-preview-failed'),
      role: 'assistant',
      streaming: false,
      thinking: false,
      parts: [
        {
          type: 'text',
          text: '![preview.png](https://x/preview.png)',
          state: 'done'
        },
        {
          type: 'tool',
          callId: 'tool_0',
          name: 'preview_image',
          state: 'done'
        },
        {
          type: 'text',
          text: 'The preview above failed to render.',
          state: 'done'
        }
      ]
    }

    render(AgentMessage, {
      props: { message },
      global: { plugins: [i18n] }
    })

    const group = screen.getByTestId('reply-asset-group')
    const explanation = screen.getByText('The preview above failed to render.')
    expect(
      group.compareDocumentPosition(explanation) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})
