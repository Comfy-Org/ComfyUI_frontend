import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import type { TurnId } from '../../../schemas/agentApiSchema'
import type { AssistantMessage } from '../../../services/agent/agentMessageParts'

import AgentMessage from './AgentMessage.vue'

// PM-1135 / PM-1313: when a batch reply carries a tool call (or any
// agent_thinking / agent_tool_call / agent_active_tab / agent_ask event)
// between two generated assets, agentEventTransport.ts closes the open
// TextPart on that event (closeOpenText) and opens a new one for the next
// agent_message_delta. AgentMessage.vue's `groups` computed now folds
// consecutive TextParts back together when only tool/thinking parts (never
// their own group) separated them, so they render through one MarkdownStream
// and land in one ReplyAssetGroup instead of one per fragment.
//
// This test feeds AgentMessage.vue the exact fragmented `message.parts`
// shape the transport produces (two TextParts, one asset each, split by a
// tool part) directly, pinning the grouping fix at the lowest level,
// independent of agentEventTransport and the full agent-replay harness.
function fragmentedAssetsMessage(): AssistantMessage {
  return {
    id: 'msg-assets' as TurnId,
    role: 'assistant',
    streaming: false,
    thinking: false,
    parts: [
      { type: 'text', text: '![i1.png](https://x/i1.png)', state: 'done' },
      {
        type: 'tool',
        callId: 'tool_0',
        name: 'preview_image',
        state: 'done'
      },
      { type: 'text', text: '![i2.png](https://x/i2.png)', state: 'done' }
    ]
  }
}

describe('AgentMessage asset grid fragmentation', () => {
  it('PM-1135: renders a batch reply as one asset grid, even when a tool call splits it across two TextParts', () => {
    render(AgentMessage, {
      props: { message: fragmentedAssetsMessage() },
      global: { plugins: [i18n] }
    })

    expect(screen.getAllByRole('img', { name: /^i[12]\.png$/ })).toHaveLength(2)

    // Both assets should land inside the SAME grid container. A grid
    // container carries no accessible role or text to query by, so this
    // falls back to plain DOM traversal instead of a Testing Library query.
    /* eslint-disable testing-library/no-node-access -- no role/label/testid
       exists for a grid container; structural containment is the assertion. */
    const gridsWithImages = [
      ...document.querySelectorAll('[class*="grid-cols-"]')
    ].filter((grid) => grid.querySelector('img') !== null)
    expect(gridsWithImages).toHaveLength(1)
    expect(gridsWithImages[0]?.querySelectorAll('img')).toHaveLength(2)
    /* eslint-enable testing-library/no-node-access */
  })
})
