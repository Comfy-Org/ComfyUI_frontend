import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import type { AgentGreeting } from '@/workbench/extensions/agent/types/proactiveGreeting'
import EmptyState from './EmptyState.vue'

describe('approved proactive variants', () => {
  it.for([
    [
      'B',
      'empty',
      'A little help to get you started!',
      'What can you help me with?'
    ],
    [
      'B',
      'workflow',
      'A little help to get you started!',
      'What can you help me with?'
    ],
    ['C', 'empty', 'Have something in mind?', ''],
    [
      'C',
      'workflow',
      'Ask a question or describe a change.',
      'Help me improve this workflow'
    ],
    ['D', 'workflow', 'Ask a question or describe a change.', ''],
    ['D', 'empty', 'Have something in mind?', '']
  ] satisfies [
    AgentGreeting['variant'],
    AgentGreeting['canvas'],
    string,
    string
  ][])(
    '%s on %s shows the approved copy and prefill',
    async ([variant, canvas, title, prompt]) => {
      render(EmptyState, {
        props: { greeting: { variant, canvas } },
        global: { plugins: [i18n] }
      })
      await nextTick()
      expect(screen.getByRole('heading', { name: title })).toBeVisible()
      expect(useAgentComposerStore().draft).toBe(prompt)
      expect(screen.queryByTestId('suggested-prompts')).not.toBeInTheDocument()
    }
  )

  it('control retains three actionable suggestions and an empty draft', async () => {
    const { emitted } = render(EmptyState, {
      props: { greeting: { variant: 'A', canvas: 'workflow' } },
      global: { plugins: [i18n] }
    })
    expect(screen.getAllByRole('button')).toHaveLength(3)
    await userEvent.click(
      screen.getByRole('button', { name: 'Start from an idea' })
    )
    await nextTick()
    expect(emitted('insert')).toEqual([
      expect.arrayContaining([
        "I'm new to ComfyUI. Build me a simple text-to-image workflow and explain each node"
      ])
    ])
    expect(useAgentComposerStore().draft).toBe('')
  })

  it('removes its untouched prefill on a variant change but preserves retyped text', async () => {
    const composer = useAgentComposerStore()
    const view = render(EmptyState, {
      props: { greeting: { variant: 'B', canvas: 'empty' } },
      global: { plugins: [i18n] }
    })
    await view.rerender({ greeting: { variant: 'D', canvas: 'empty' } })
    expect(composer.draft).toBe('')
    await view.rerender({ greeting: { variant: 'C', canvas: 'workflow' } })
    composer.setText('')
    composer.setText('Help me improve this workflow')
    view.unmount()
    expect(composer.draft).toBe('Help me improve this workflow')
  })
})

it('updates only an untouched owned prefill when the locale changes', async () => {
  const composer = useAgentComposerStore()
  const previousLocale = i18n.global.locale.value
  const previousMessages = i18n.global.getLocaleMessage('fr')
  i18n.global.mergeLocaleMessage('fr', {
    agent: {
      proactiveGreeting: { firstOpen: { prompt: 'Comment peux-tu m’aider ?' } }
    }
  })
  const view = render(EmptyState, {
    props: { greeting: { variant: 'B', canvas: 'empty' } },
    global: { plugins: [i18n] }
  })
  try {
    i18n.global.locale.value = 'fr'
    await nextTick()
    expect(composer.draft).toBe('Comment peux-tu m’aider ?')
    composer.setText('My own request')
    i18n.global.locale.value = 'en'
    await nextTick()
    expect(composer.draft).toBe('My own request')
  } finally {
    view.unmount()
    i18n.global.locale.value = previousLocale
    i18n.global.setLocaleMessage('fr', previousMessages)
  }
})
