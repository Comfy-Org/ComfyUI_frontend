import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

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
        name: 'Create a polished product image from a text prompt'
      })
    ).toBeVisible()
    expect(emitted('starterPromptRendered')).toEqual([['test']])
  })
})
