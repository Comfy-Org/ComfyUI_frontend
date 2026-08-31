import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { i18n } from '@/i18n'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { useAgentPanelStore } from '../../stores/agent/agentPanelStore'

import AgentOnboardingGuide from './AgentOnboardingGuide.vue'

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => undefined
}))

const Harness = defineComponent({
  components: { AgentOnboardingGuide },
  setup() {
    const guide = ref<InstanceType<typeof AgentOnboardingGuide>>()
    return { guide }
  },
  template: `
    <button @click="guide?.open()">Open guide</button>
    <AgentOnboardingGuide ref="guide" />
  `
})

describe('AgentOnboardingGuide', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('guides the input-process-output sequence before offering Agent', async () => {
    render(Harness, { global: { plugins: [i18n] } })
    await userEvent.click(screen.getByRole('button', { name: 'Open guide' }))
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.onboarding.start')
      })
    )

    const finish = screen.getByRole('button', {
      name: i18n.global.t('agent.onboarding.finish')
    })
    expect(finish).toBeDisabled()

    for (const node of ['prompt', 'generate', 'output'] as const) {
      await userEvent.click(
        screen.getByRole('button', {
          name: i18n.global.t(`agent.onboarding.nodes.${node}`)
        })
      )
    }

    expect(finish).toBeEnabled()
    await userEvent.click(finish)
    expect(
      screen.getByText(i18n.global.t('agent.onboarding.completeDescription'))
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.onboarding.build')
      })
    )
    expect(useAgentComposerStore().pendingSubmission?.text).toBe(
      i18n.global.t('agent.onboarding.samplePrompt')
    )
    expect(useAgentPanelStore().isOpen).toBe(true)
  })

  it('accepts the highlighted component through drag and drop', async () => {
    render(Harness, { global: { plugins: [i18n] } })
    await userEvent.click(screen.getByRole('button', { name: 'Open guide' }))
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.onboarding.start')
      })
    )
    const data = new Map<string, string>()
    const dataTransfer = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? ''
    }
    const prompt = screen.getByRole('button', {
      name: i18n.global.t('agent.onboarding.nodes.prompt')
    })

    await fireEvent.dragStart(prompt, { dataTransfer })
    await fireEvent.drop(screen.getByTestId('agent-onboarding-canvas'), {
      dataTransfer
    })

    expect(
      screen.getByRole('button', {
        name: i18n.global.t('agent.onboarding.nodes.generate')
      })
    ).toBeEnabled()
  })
})
