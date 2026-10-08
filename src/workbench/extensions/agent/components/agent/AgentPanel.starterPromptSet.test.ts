import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

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
        starterPromptAssignment: 'test',
        attributeStarterPromptExperiment: true
      },
      global: {
        plugins: [i18n],
        directives: { tooltip: {} },
        stubs: { WorkflowSelectorChip: true }
      }
    })

    expect(
      screen.getByRole('button', {
        name: i18n.global.t('agent.suggestedPrompts.treatment.cloud.0')
      })
    ).toBeVisible()
    expect(emitted('starterPromptRendered')).toEqual([['test']])
  })
})
