import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

import { i18n } from '@/i18n'

import AgentPanel from './AgentPanel.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()

describe('AgentPanel starter prompt set', () => {
  it('renders and forwards the treatment exposure', () => {
    const { emitted } = render(AgentPanel, {
      props: {
        entries: [],
        historyGroups: { current: [], today: [], yesterday: [], earlier: [] },
        starterPromptAssignment: 'test'
      },
      global: {
        plugins: [i18n],
        directives: { tooltip: {} },
        stubs: { WorkflowSelectorChip: true }
      }
    })

    expect(
      screen.getByRole('button', {
        name: 'Build an image workflow with my installed models'
      })
    ).toBeVisible()
    expect(emitted('starterPromptRendered')).toEqual([['test']])
  })
})
