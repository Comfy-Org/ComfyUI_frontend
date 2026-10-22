/**
 * The ask_kinds advertisement is a promise, and this is the only thing that
 * checks we keep it.
 *
 * `agentRestClient` sends `ask_kinds: [...RENDERED_ASK_KINDS]` on every message
 * POST. Cloud reads that list as "these are the cards this client can render"
 * and registers the matching tool only for the kinds it names
 * (`AskUserSuspendsFor` in services/agent/internal/loop/asks.go). So a kind we
 * advertise but do not actually render costs the user the whole interaction:
 * the model is handed a tool, calls it, the turn parks on an ask, and the panel
 * shows the generic "can't show this" notice instead of a card. The same
 * comment in asks.go records what that cost in production.
 *
 * Most of the chain is already type-checked, and deliberately so:
 *
 *   1. RENDERED_ASK_KINDS `satisfies readonly AgentAskKind[]`, so we cannot
 *      advertise a kind absent from the wire contract.
 *   2. ASK_PART_BUILDERS is a total `Record<RenderedAskKind, ...>`, so every
 *      advertised kind has a builder.
 *   3. `cardGroup`'s switch is exhaustive over the part union, and deleting a
 *      card's branch from `AgentMessageGroup.vue` fails the build too — the
 *      part falls through to the bare `v-else`, and `AgentNoticeCard`'s `part`
 *      prop does not accept a non-notice part.
 *
 * What none of that covers is a builder that satisfies the Record and still
 * returns `undefined` — the advertise-before-render state. It is type-legal,
 * and this codebase has already shipped it once on purpose: `delete_approval`
 * was listed in `ask_kinds` while the card did not exist yet, which both
 * asks.go and the openapi description still record.
 *
 * `agentRestClient.test.ts` is not that guard either. It restates the expected
 * `ask_kinds` literal, so it fails when the list *changes* and goes green again
 * the moment the literal is updated — which is the natural fix, and leaves the
 * divergence live. Measured by mutating RENDERED_ASK_KINDS to advertise
 * `paused` with a stub builder and updating those six literals as a developer
 * would: `pnpm typecheck` clean, 218 pre-existing agent tests green, and only
 * this file red.
 *
 * So this test decides "renderable" from what the panel actually puts on
 * screen, and compares the resulting set against the advertised one. It
 * iterates `zAgentAskKind.options` — the generated wire vocabulary — rather
 * than a local list, so a kind added to services/ingest/openapi.yaml arrives
 * here as a failure that has to be ruled on instead of defaulting to silently
 * unadvertised.
 *
 * Context: FE-3465, where staging ran a frontend build that advertised nothing
 * and Cloud therefore never registered `ask_user`. That skew was a release
 * sequencing fact rather than a defect, but the same symptom — no card, agent
 * asks in plain text — is what a source-level divergence here would produce,
 * with nothing to catch it.
 */
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { createI18n } from 'vue-i18n'

import type { AgentAskKind } from '@comfyorg/ingest-types'
import { zAgentAskKind } from '@comfyorg/ingest-types/zod'
import type { TurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import {
  RENDERED_ASK_KINDS,
  toTurnId
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type { AssistantMessage } from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import { toAskOrNoticePart } from '@/workbench/extensions/agent/services/agent/agentMessageParts'

import AgentMessage from './AgentMessage.vue'

const ASK_UNAVAILABLE = enMessages.agent.askUnavailable

/**
 * Built here rather than imported from `@/i18n`: this file sits in the
 * `agent/presentation` zone, which may not reach `app-host/application` (see
 * docs/architecture/domains/boundaries.json). The English bundle is all the
 * cards need, and the options mirror the app's own `createI18n` call.
 */
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  escapeParameter: true,
  messages: { en: enMessages }
})

type CanonicalAsk = Parameters<typeof toAskOrNoticePart>[0]

/**
 * A well-formed ask per wire kind: the shape Cloud sends when it raises that
 * card, with nothing wrong with it. Anything these asks fail to render is a
 * frontend gap, not bad input — the malformed-input cases are covered by
 * agentMessageParts.test.ts.
 *
 * Declaring it as a total Record is the compile-time half of the same guard:
 * a new AgentAskKind cannot be ignored here either.
 */
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
    // hidden_node_count is omitted deliberately: the wire contract gives it
    // `minimum: 1` and says to leave it out when every node is listed.
    context: {
      action: 'delete_nodes',
      nodes: [{ id: '3', type: 'KSampler' }]
    }
  },
  /**
   * Not negotiated, by the wire contract's own words: "the pause card is raised
   * for every client, so listing it changes nothing". So Cloud can send this to
   * a panel that cannot render it, and the stand-in notice is the intended
   * outcome rather than a divergence. Pinned below so dropping it into
   * RENDERED_ASK_KINDS without building a card is caught here.
   */
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

function messageFor(ask: CanonicalAsk): AssistantMessage {
  return {
    id: toTurnId(`msg-${ask.kind}`) satisfies TurnId,
    role: 'assistant',
    parts: [toAskOrNoticePart(ask)],
    streaming: false,
    thinking: false
  }
}

/**
 * True when the panel put a card the user can answer on screen.
 *
 * Both halves matter. Without the notice check a stand-in notice would count as
 * a card; without the control check, a card that rendered its heading but no
 * answer controls would count, and an ask the user cannot answer is not a
 * rendered card as far as the advertisement is concerned.
 */
function rendersAnAnswerableCard(kind: AgentAskKind): boolean {
  const { unmount } = render(AgentMessage, {
    props: { message: messageFor(CANONICAL_ASKS[kind]) },
    global: { plugins: [i18n] }
  })
  try {
    return (
      screen.queryByText(ASK_UNAVAILABLE) === null &&
      screen.queryAllByRole('button').length > 0
    )
  } finally {
    unmount()
  }
}

const WIRE_ASK_KINDS = zAgentAskKind.options

describe('ask_kinds advertisement matches what the panel renders', () => {
  it('advertises exactly the kinds that render a card', () => {
    const renderable = WIRE_ASK_KINDS.filter(rendersAnAnswerableCard)

    // Both directions: nothing advertised is unrenderable, and nothing
    // renderable goes unadvertised (an unadvertised card is unreachable,
    // because Cloud never registers the tool that raises it).
    expect(renderable).toEqual(expect.arrayContaining([...RENDERED_ASK_KINDS]))
    expect(renderable).toHaveLength(RENDERED_ASK_KINDS.length)
  })

  it.for([...RENDERED_ASK_KINDS])(
    'renders an answerable %s card rather than the stand-in notice',
    (kind) => {
      render(AgentMessage, {
        props: { message: messageFor(CANONICAL_ASKS[kind]) },
        global: { plugins: [i18n] }
      })

      expect(screen.queryByText(ASK_UNAVAILABLE)).not.toBeInTheDocument()
      // A card the user cannot act on is not a rendered card.
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
    }
  )

  it.for(
    WIRE_ASK_KINDS.filter(
      (kind) => !RENDERED_ASK_KINDS.some((rendered) => rendered === kind)
    )
  )('stands a notice in for the unadvertised %s ask', (kind) => {
    render(AgentMessage, {
      props: { message: messageFor(CANONICAL_ASKS[kind]) },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText(ASK_UNAVAILABLE)).toBeInTheDocument()
    expect(
      screen.queryByText(CANONICAL_ASKS[kind].prompt)
    ).not.toBeInTheDocument()
  })
})
