import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { assert, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import { i18n } from '@/i18n'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import AgentPanel from './AgentPanel.vue'
import Composer from './Composer.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/workbench/extensions/agent/services/agent/agentAuth'))

setupInlinePromptEditorDom()

function mountPanel() {
  return render(AgentPanel, {
    props: {
      entries: [],
      historyGroups: { current: [], today: [], yesterday: [], earlier: [] },
      greeting: { variant: 'C', canvas: 'empty' }
    },
    global: {
      plugins: [i18n],
      directives: { tooltip: {} }
    }
  })
}

describe('Greeting prefill focus and animation', () => {
  it.for([
    { control: 'workflow selector', label: enMessages.agent.switchWorkflow },
    { control: 'reference button', label: enMessages.agent.reference }
  ])(
    'preserves the focused $control when a prefill arrives',
    async ({ label }) => {
      const view = mountPanel()
      const control = screen.getByRole('button', { name: label })
      control.focus()
      expect(control).toHaveFocus()

      await view.rerender({ greeting: { variant: 'C', canvas: 'workflow' } })
      await waitFor(() =>
        expect(screen.getByRole('textbox')).toHaveTextContent(
          'Help me improve this workflow'
        )
      )
      await nextTick()

      expect(control).toHaveFocus()
    }
  )

  it('focuses the prefill when the first workflow appears with body focus', async () => {
    const view = mountPanel()
    expect(document.body).toHaveFocus()

    await view.rerender({ greeting: { variant: 'C', canvas: 'workflow' } })
    const editor = screen.getByRole('textbox')
    await waitFor(() => expect(editor).toHaveFocus())
    expect(editor).toHaveTextContent('Help me improve this workflow')
  })

  it('preserves canvas focus when the first workflow triggers a prefill', async () => {
    const view = mountPanel()
    render({
      template: '<canvas tabindex="0" aria-label="Workflow canvas" />'
    })
    const canvas = screen.getByLabelText('Workflow canvas')
    canvas.focus()
    expect(canvas).toHaveFocus()

    await view.rerender({ greeting: { variant: 'C', canvas: 'workflow' } })
    await waitFor(() =>
      expect(screen.getByRole('textbox')).toHaveTextContent(
        'Help me improve this workflow'
      )
    )
    await nextTick()

    expect(canvas).toHaveFocus()
  })

  it.for([
    { action: 'types', edit: () => userEvent.keyboard('!') },
    { action: 'pastes', edit: () => userEvent.paste('!') }
  ])(
    'renders the prefill fade and stops it when the user $action',
    async ({ edit }) => {
      const view = mountPanel()
      await view.rerender({ greeting: { variant: 'C', canvas: 'workflow' } })
      const editor = screen.getByRole('textbox')
      await waitFor(() => expect(editor).toHaveFocus())
      const animatedEditor = screen.getByTestId('composer-editor')
      expect(animatedEditor).toHaveClass('agent-talk-fade')
      expect(animatedEditor.style.getPropertyValue('--talk-delay')).toMatch(
        /^\d+ms$/
      )

      await edit()

      expect(editor).toHaveTextContent('Help me improve this workflow!')
      expect(animatedEditor).not.toHaveClass('agent-talk-fade')
      expect(animatedEditor.style.getPropertyValue('--talk-delay')).toBe('')
    }
  )

  it('honors a focus change while the prefill waits for rendering', async () => {
    const composer = ref<InstanceType<typeof Composer>>()
    render(
      defineComponent({
        setup: () => () => h(Composer, { ref: composer })
      }),
      { global: { plugins: [i18n] } }
    )
    render({ template: '<button>Outside action</button>' })
    useAgentComposerStore().prefillGreeting('Help me improve this workflow')
    await nextTick()
    assert.exists(composer.value)
    screen.getByRole('textbox').focus()
    const pending = composer.value.focusPrefill(250)
    const outside = screen.getByRole('button', { name: 'Outside action' })
    outside.focus()

    await pending

    expect(outside).toHaveFocus()
    const animatedEditor = screen.getByTestId('composer-editor')
    expect(animatedEditor).toHaveClass('agent-talk-fade')
    expect(animatedEditor.style.getPropertyValue('--talk-delay')).toBe('250ms')
  })
})
