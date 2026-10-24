import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { createI18n } from 'vue-i18n'

import type { AgentAskKind } from '@comfyorg/ingest-types'
import { zAgentAskKind } from '@comfyorg/ingest-types/zod'
import type {
  RenderedAskKind,
  TurnId
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import {
  RENDERED_ASK_KINDS,
  toTurnId
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type { AssistantMessage } from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import { toAskOrNoticePart } from '@/workbench/extensions/agent/services/agent/agentMessageParts'

import AgentMessage from './AgentMessage.vue'

const ASK_UNAVAILABLE = enMessages.agent.askUnavailable
const ADVERTISED_ASK_KINDS: readonly AgentAskKind[] = RENDERED_ASK_KINDS
const WIRE_ASK_KINDS = zAgentAskKind.options

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  escapeParameter: true,
  messages: { en: enMessages }
})

type CanonicalAsk = Parameters<typeof toAskOrNoticePart>[0]

const CANONICAL_ASKS: Record<AgentAskKind, CanonicalAsk> = {
  run_approval: {
    kind: 'run_approval',
    ask_id: 'turn-1:call-run',
    prompt: 'Run this workflow?',
    options: [
      { id: 'run', label: 'Run' },
      { id: 'cancel', label: 'Cancel' }
    ],
    min_selections: 1,
    max_selections: 1,
    allow_other: false,
    context: { workflow_id: 'wf-1', workflow_name: 'Flow' }
  },
  ask_user: {
    kind: 'ask_user',
    ask_id: 'turn-1:call-ask',
    prompt: 'Which style?',
    options: [
      { id: 'oil', label: 'Oil painting' },
      { id: 'ink', label: 'Ink' }
    ],
    min_selections: 1,
    max_selections: 1,
    allow_other: false
  },
  delete_approval: {
    kind: 'delete_approval',
    ask_id: 'turn-1:call-delete',
    prompt: 'Delete these nodes?',
    options: [
      { id: 'delete', label: 'Delete' },
      { id: 'keep', label: 'Keep' }
    ],
    min_selections: 1,
    max_selections: 1,
    allow_other: false,
    context: {
      action: 'delete_nodes',
      nodes: [{ id: '3', type: 'KSampler' }]
    }
  },
  paused: {
    kind: 'paused',
    ask_id: 'turn-1:call-paused',
    prompt: 'Paused until credits are added.',
    options: [{ id: 'resume', label: 'Resume' }],
    min_selections: 1,
    max_selections: 1,
    allow_other: false,
    context: {
      message: 'Paused until credits are added.',
      reason: 'no_funds',
      recheck_after_seconds: 60
    }
  }
}

const CARD_BACKED_ASK_KINDS = [
  'run_approval',
  'ask_user',
  'delete_approval'
] as const satisfies readonly AgentAskKind[]

interface AnswerControl {
  role: 'button' | 'radio'
  name: string
}

const ANSWER_CONTROLS: Record<RenderedAskKind, readonly AnswerControl[]> = {
  run_approval: [
    { role: 'button', name: enMessages.agent.runApproval.run },
    { role: 'button', name: enMessages.agent.runApproval.cancel }
  ],
  ask_user: [
    { role: 'radio', name: 'Oil painting' },
    { role: 'radio', name: 'Ink' },
    { role: 'button', name: enMessages.g.submit }
  ],
  delete_approval: [
    { role: 'button', name: enMessages.agent.deleteApproval.delete },
    { role: 'button', name: enMessages.agent.deleteApproval.keep }
  ]
}

function messageFor(ask: CanonicalAsk): AssistantMessage {
  return {
    id: toTurnId(`msg-${ask.kind}`) satisfies TurnId,
    role: 'assistant',
    parts: [toAskOrNoticePart(ask)],
    streaming: false,
    thinking: false
  }
}

function renderAsk(kind: AgentAskKind) {
  return render(AgentMessage, {
    props: { message: messageFor(CANONICAL_ASKS[kind]) },
    global: { plugins: [i18n] }
  })
}

function rendersACardRatherThanTheNotice(kind: AgentAskKind): boolean {
  const { unmount } = renderAsk(kind)
  try {
    return screen.queryByText(ASK_UNAVAILABLE) === null
  } finally {
    unmount()
  }
}

describe('ask_kinds advertisement matches what the panel renders', () => {
  it('advertises exactly the wire kinds that render a card', () => {
    const renderable = WIRE_ASK_KINDS.filter(rendersACardRatherThanTheNotice)

    expect(renderable).toEqual(
      expect.arrayContaining([...ADVERTISED_ASK_KINDS])
    )
    expect(renderable).toHaveLength(ADVERTISED_ASK_KINDS.length)
  })

  it('advertises every kind the panel has built a card for', () => {
    expect(ADVERTISED_ASK_KINDS).toEqual(
      expect.arrayContaining([...CARD_BACKED_ASK_KINDS])
    )
  })

  it('leaves paused unadvertised, because cloud raises it for every client', () => {
    expect(ADVERTISED_ASK_KINDS).not.toContain('paused')
  })

  it.for([...RENDERED_ASK_KINDS])(
    'renders every control needed to answer a %s ask',
    (kind) => {
      const { container } = renderAsk(kind)
      const card = within(container as HTMLElement)
      const expected = ANSWER_CONTROLS[kind]

      expect(card.queryByText(ASK_UNAVAILABLE)).not.toBeInTheDocument()
      expect(
        expected.map(({ role, name }) => ({
          role,
          name,
          rendered: card.queryByRole(role, { name }) !== null
        }))
      ).toEqual(expected.map((control) => ({ ...control, rendered: true })))
    }
  )

  it.for(WIRE_ASK_KINDS.filter((kind) => !ADVERTISED_ASK_KINDS.includes(kind)))(
    'stands a notice in for the unadvertised %s ask',
    (kind) => {
      renderAsk(kind)

      expect(screen.getByText(ASK_UNAVAILABLE)).toBeInTheDocument()
      expect(
        screen.queryByText(CANONICAL_ASKS[kind].prompt)
      ).not.toBeInTheDocument()
    }
  )
})
