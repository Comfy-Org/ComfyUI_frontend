import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { toRaw } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import EmptyState from './EmptyState.vue'

const distribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

const LOCAL_PROMPTS = [
  {
    id: 'slot_1',
    text: 'Generate a realistic portrait of an astronaut'
  },
  {
    id: 'slot_2',
    text: 'An image-to-video workflow that fits my GPU'
  },
  { id: 'slot_3', text: 'Explain the selected nodes' },
  {
    id: 'slot_4',
    text: 'Help me install the missing nodes for this workflow'
  },
  {
    id: 'slot_5',
    text: 'Fix the errors in this workflow'
  }
] as const

const CLOUD_PROMPTS = [
  { id: 'slot_1', text: 'Create a product image from a text prompt' },
  { id: 'slot_2', text: 'Build an image-to-video workflow' },
  { id: 'slot_3', text: 'Explain how a ComfyUI workflow works' },
  { id: 'slot_4', text: 'Find the best workflow for a specific task' },
  { id: 'slot_5', text: 'Diagnose and fix errors in a workflow' }
] as const

describe('EmptyState', () => {
  beforeEach(() => {
    distribution.isCloud = false
  })

  it('hides the selected-node suggestion without a selection', () => {
    render(EmptyState, {
      global: { plugins: [i18n] }
    })

    expect(
      screen.queryByRole('button', { name: LOCAL_PROMPTS[2].text })
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  it('shows the selected-node suggestion with a selection', () => {
    render(EmptyState, {
      props: { hasSelection: true },
      global: { plugins: [i18n] }
    })

    expect(
      screen.getByRole('button', { name: LOCAL_PROMPTS[2].text })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('preserves prompt slot attribution when the selected-node suggestion is hidden', async () => {
    const user = userEvent.setup()
    const { emitted } = render(EmptyState, {
      global: { plugins: [i18n] }
    })

    await user.click(
      screen.getByRole('button', { name: LOCAL_PROMPTS[3].text })
    )

    expect(emitted().insert).toEqual([
      [
        LOCAL_PROMPTS[3].text,
        expect.objectContaining({
          promptId: 'slot_4',
          promptIndex: 3,
          promptCount: 4,
          visiblePromptCount: 4
        })
      ]
    ])
  })

  it('keeps the treatment prompt in the same slot without a selection', () => {
    distribution.isCloud = true
    render(EmptyState, {
      props: { assignment: 'test', attributeExperiment: true },
      global: { plugins: [i18n] }
    })

    expect(
      screen.getByRole('button', {
        name: 'Explain how a ComfyUI workflow works'
      })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('renders every local suggestion without truncating the inserted prompt', async () => {
    const user = userEvent.setup()
    const { emitted } = render(EmptyState, {
      props: { hasSelection: true },
      global: { plugins: [i18n] }
    })
    const prompt = 'Fix the errors in this workflow'
    const suggestion = screen.getByRole('button', { name: prompt })

    expect(screen.getAllByRole('button')).toHaveLength(5)

    await user.click(suggestion)

    expect(emitted().insert).toEqual([
      [
        prompt,
        {
          promptId: 'slot_5',
          promptIndex: 4,
          promptCount: 5,
          visiblePromptCount: 5,
          promptTextHash: '2f8b1ba4',
          locale: 'en'
        }
      ]
    ])
  })

  it('separates the visible count from the set size in a narrow panel', async () => {
    const user = userEvent.setup()
    const { emitted } = render(EmptyState, {
      global: { plugins: [i18n] }
    })
    const buttons = screen.getAllByRole('button')
    buttons.slice(3).forEach((button) => (button.style.display = 'none'))

    await user.click(buttons[0])

    expect(emitted().insert).toEqual([
      [
        LOCAL_PROMPTS[0].text,
        expect.objectContaining({
          promptId: 'slot_1',
          promptCount: 4,
          visiblePromptCount: 3
        })
      ]
    ])
  })

  it('renders the winning static Cloud prompts without experiment attribution', async () => {
    distribution.isCloud = true
    const user = userEvent.setup()
    const { emitted } = render(EmptyState, {
      global: { plugins: [i18n] }
    })

    const text = i18n.global.t('agent.suggestedPrompts.treatment.cloud.0')
    await user.click(screen.getByRole('button', { name: text }))

    expect(emitted().insert).toEqual([
      [text, expect.not.objectContaining({ assignment: expect.anything() })]
    ])
  })

  it('falls back to the existing Cloud copy until a locale has winning copy', async () => {
    const previousLocale = i18n.global.locale.value
    i18n.global.locale.value = 'zh'
    distribution.isCloud = true
    try {
      render(EmptyState, { global: { plugins: [i18n] } })

      expect(
        screen.getByRole('button', {
          name: i18n.global.t('agent.suggestedPrompts.cloud.0')
        })
      ).toBeVisible()
    } finally {
      i18n.global.locale.value = previousLocale
    }
  })

  it.for([
    ...LOCAL_PROMPTS.map((prompt, index) => ({
      ...prompt,
      index,
      distribution: 'local' as const
    })),
    ...CLOUD_PROMPTS.map((prompt, index) => ({
      ...prompt,
      index,
      distribution: 'cloud' as const
    }))
  ])(
    'renders $distribution slot $index as $text and attributes it to $id',
    async ({ id, text, index, distribution: promptDistribution }) => {
      distribution.isCloud = promptDistribution === 'cloud'
      const user = userEvent.setup()
      const { emitted } = render(EmptyState, {
        props: { hasSelection: true },
        global: { plugins: [i18n] }
      })

      await user.click(screen.getByRole('button', { name: text }))

      const calls = emitted().insert as [string, unknown][]
      expect(calls).toHaveLength(1)
      expect(calls[0][1]).toMatchObject({
        promptId: id,
        promptIndex: index,
        promptCount: 5
      })
    }
  )

  it('emits nothing until a chip is clicked', () => {
    const { emitted } = render(EmptyState, { global: { plugins: [i18n] } })

    expect(emitted().insert).toBeUndefined()
  })

  it('emits once per click, so two clicks are two choices', async () => {
    const user = userEvent.setup()
    const { emitted } = render(EmptyState, { global: { plugins: [i18n] } })

    await user.click(
      screen.getByRole('button', { name: LOCAL_PROMPTS[0].text })
    )
    await user.click(
      screen.getByRole('button', { name: LOCAL_PROMPTS[1].text })
    )

    expect(
      emitted().insert.map((call) => (call as unknown[])[1])
    ).toMatchObject([{ promptId: 'slot_1' }, { promptId: 'slot_2' }])
  })

  it('distinguishes the copy a click was made against, without carrying it', async () => {
    const user = userEvent.setup()
    const { emitted } = render(EmptyState, { global: { plugins: [i18n] } })

    await user.click(
      screen.getByRole('button', { name: LOCAL_PROMPTS[1].text })
    )

    const [[, attribution]] = emitted().insert as [
      string,
      { [k: string]: unknown }
    ][]
    expect(attribution.promptTextHash).toBe('ebed5d67')
    expect(attribution.promptTextHash).not.toBe('90a652b3')
    expect(Object.values(attribution)).not.toContain(LOCAL_PROMPTS[1].text)
  })

  it('attributes fallback English copy to its source locale', async () => {
    const previousLocale = i18n.global.locale.value
    i18n.global.locale.value = 'zh'
    try {
      const user = userEvent.setup()
      const { emitted } = render(EmptyState, { global: { plugins: [i18n] } })
      const localizedPrompt = i18n.global.t('agent.suggestedPrompts.local.0')

      await user.click(screen.getByRole('button', { name: localizedPrompt }))

      expect(emitted().insert).toEqual([
        [
          localizedPrompt,
          expect.objectContaining({
            promptTextHash: '28581603',
            locale: 'en'
          })
        ]
      ])
    } finally {
      i18n.global.locale.value = previousLocale
    }
  })

  it('attributes translated copy to the locale that supplied it', async () => {
    const previousLocale = i18n.global.locale.value
    const previousMessages = structuredClone(
      toRaw(i18n.global.getLocaleMessage('zh'))
    )
    const translatedPrompts = LOCAL_PROMPTS.map(
      ({ text }, index) => `translated ${index + 1}: ${text}`
    )
    i18n.global.mergeLocaleMessage('zh', {
      agent: { suggestedPrompts: { local: translatedPrompts } }
    })
    i18n.global.locale.value = 'zh'
    try {
      const user = userEvent.setup()
      const { emitted } = render(EmptyState, { global: { plugins: [i18n] } })

      await user.click(
        screen.getByRole('button', { name: translatedPrompts[0] })
      )

      expect(emitted().insert).toEqual([
        [translatedPrompts[0], expect.objectContaining({ locale: 'zh' })]
      ])
    } finally {
      i18n.global.locale.value = previousLocale
      i18n.global.setLocaleMessage('zh', previousMessages)
    }
  })

  it('uses the winning static prompts after their translations land', async () => {
    const previousLocale = i18n.global.locale.value
    const previousMessages = structuredClone(
      toRaw(i18n.global.getLocaleMessage('zh'))
    )
    const translatedPrompts = CLOUD_PROMPTS.map(
      ({ text }, index) => `translated ${index + 1}: ${text}`
    )
    i18n.global.mergeLocaleMessage('zh', {
      agent: {
        suggestedPrompts: { treatment: { cloud: translatedPrompts } }
      }
    })
    i18n.global.locale.value = 'zh'
    distribution.isCloud = true
    try {
      const user = userEvent.setup()
      const { emitted } = render(EmptyState, { global: { plugins: [i18n] } })

      await user.click(
        screen.getByRole('button', { name: translatedPrompts[0] })
      )

      expect(emitted().insert).toEqual([
        [translatedPrompts[0], expect.objectContaining({ locale: 'zh' })]
      ])
    } finally {
      i18n.global.locale.value = previousLocale
      i18n.global.setLocaleMessage('zh', previousMessages)
    }
  })
})
