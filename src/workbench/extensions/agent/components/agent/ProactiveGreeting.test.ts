import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import ProactiveGreeting from './ProactiveGreeting.vue'

const QUESTION =
  'Why isn’t the vae input on VAE Decode connected, and what should go there?'

function renderUnconnectedInput() {
  const { emitted } = render(ProactiveGreeting, {
    props: {
      greeting: { kind: 'unconnectedInput', node: 'VAE Decode', input: 'vae' }
    },
    global: { plugins: [i18n] }
  })
  return {
    emitted,
    button: screen.getByRole('button', { name: 'Ask about this input' })
  }
}

const IMPROVE = 'Help me improve this workflow'

function renderWorkflowOpen() {
  return render(ProactiveGreeting, {
    props: { greeting: { kind: 'workflowOpen' } },
    global: { plugins: [i18n] }
  })
}

describe('ProactiveGreeting', () => {
  it('suggests its prompt in an empty composer', () => {
    const { emitted } = renderWorkflowOpen()

    expect(emitted('insert')).toEqual([[IMPROVE, expect.any(Number)]])
  })

  it('leaves text the user already wrote alone', () => {
    useAgentComposerStore().setText('My own question')

    const { emitted } = renderWorkflowOpen()

    expect(emitted('insert')).toBeUndefined()
  })

  it.for([
    { draft: IMPROVE, after: '' },
    { draft: `${IMPROVE} for portraits`, after: `${IMPROVE} for portraits` }
  ])(
    'takes back its untouched suggestion when it goes away ("$draft")',
    ({ draft, after }) => {
      const { unmount } = renderWorkflowOpen()
      const store = useAgentComposerStore()
      store.setText(draft)

      unmount()

      expect(store.draft).toBe(after)
    }
  )

  it('asks the question about the unconnected input', async () => {
    const { emitted, button } = renderUnconnectedInput()

    await userEvent.click(button)

    expect(emitted('insert')).toEqual([[QUESTION]])
  })

  it.for([
    { draft: QUESTION, disabled: true },
    { draft: `Please answer: ${QUESTION}`, disabled: true },
    { draft: '', disabled: false },
    { draft: 'Something else entirely', disabled: false }
  ])(
    'is disabled $disabled while the composer holds "$draft"',
    async ({ draft, disabled }) => {
      const { button } = renderUnconnectedInput()

      useAgentComposerStore().setText(draft)
      await nextTick()

      expect(button).toHaveProperty('disabled', disabled)
    }
  )
})
