import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
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
  { id: 'slot_1', text: 'Generate a character sheet of an astronaut' },
  { id: 'slot_2', text: 'Turn the product image into a short ad' },
  { id: 'slot_3', text: 'Explain the selected nodes' },
  { id: 'slot_4', text: 'Best image upscale workflow for 4K' },
  { id: 'slot_5', text: 'Fix the errors in this workflow' }
] as const

describe('EmptyState', () => {
  beforeEach(() => {
    distribution.isCloud = false
  })

  it('renders every local suggestion without truncating the inserted prompt', async () => {
    const user = userEvent.setup()
    const { emitted } = render(EmptyState, {
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
          promptTextHash: '2f8b1ba4',
          locale: 'en'
        }
      ]
    ])
  })

  it.for([
    {
      locale: 'en',
      assignment: 'control',
      key: 'agent.suggestedPrompts.cloud.0',
      reported: 'control'
    },
    {
      locale: 'en',
      assignment: 'test',
      key: 'agent.suggestedPrompts.treatment.cloud.0',
      reported: 'test'
    }
  ] as const)(
    'renders and reports $assignment for an eligible $locale locale',
    async ({ locale, assignment, key, reported }) => {
      const previousLocale = i18n.global.locale.value
      i18n.global.locale.value = locale
      distribution.isCloud = true
      try {
        const user = userEvent.setup()
        const { emitted } = render(EmptyState, {
          props: { assignment, attributeExperiment: true },
          global: { plugins: [i18n] }
        })
        const text = i18n.global.t(key)

        await user.click(screen.getByRole('button', { name: text }))

        expect(emitted().rendered).toEqual([[reported]])
        expect(emitted().insert).toEqual([
          [text, expect.objectContaining({ assignment: reported })]
        ])
      } finally {
        i18n.global.locale.value = previousLocale
      }
    }
  )

  it.for([
    {
      locale: 'zh',
      assignment: 'control',
      key: 'agent.suggestedPrompts.cloud.0'
    },
    {
      locale: 'zh',
      assignment: 'test',
      key: 'agent.suggestedPrompts.cloud.0'
    }
  ] as const)(
    'renders control without reporting $assignment for an ineligible $locale locale',
    async ({ locale, assignment, key }) => {
      const previousLocale = i18n.global.locale.value
      i18n.global.locale.value = locale
      distribution.isCloud = true
      try {
        const user = userEvent.setup()
        const { emitted } = render(EmptyState, {
          props: { assignment, attributeExperiment: true },
          global: { plugins: [i18n] }
        })
        const text = i18n.global.t(key)

        await user.click(screen.getByRole('button', { name: text }))

        expect(emitted()).not.toHaveProperty('rendered')
        expect(emitted().insert).toEqual([
          [text, expect.not.objectContaining({ assignment: expect.anything() })]
        ])
      } finally {
        i18n.global.locale.value = previousLocale
      }
    }
  )

  it('omits experiment attribution for a QA-rendered treatment', async () => {
    distribution.isCloud = true
    const user = userEvent.setup()
    const { emitted } = render(EmptyState, {
      props: { assignment: 'test', attributeExperiment: false },
      global: { plugins: [i18n] }
    })

    const text = i18n.global.t('agent.suggestedPrompts.treatment.cloud.0')
    await user.click(screen.getByRole('button', { name: text }))

    expect(emitted().insert).toEqual([
      [text, expect.not.objectContaining({ assignment: expect.anything() })]
    ])
  })

  it('keeps attributing the arm it rendered when the assignment changes', async () => {
    distribution.isCloud = true
    const user = userEvent.setup()
    const { emitted, rerender } = render(EmptyState, {
      props: { assignment: 'test', attributeExperiment: true },
      global: { plugins: [i18n] }
    })

    await rerender({ assignment: 'control', attributeExperiment: false })
    const text = i18n.global.t('agent.suggestedPrompts.treatment.cloud.0')
    await user.click(screen.getByRole('button', { name: text }))

    expect(emitted().insert).toEqual([
      [text, expect.objectContaining({ assignment: 'test' })]
    ])
  })

  it('does not attribute a surface that mounted before experiment config loaded', async () => {
    distribution.isCloud = true
    const user = userEvent.setup()
    const { emitted, rerender } = render(EmptyState, {
      props: {
        assignment: 'control',
        attributeExperiment: false
      },
      global: { plugins: [i18n] }
    })

    await rerender({
      assignment: 'test',
      attributeExperiment: true
    })
    const text = i18n.global.t('agent.suggestedPrompts.cloud.0')
    await user.click(screen.getByRole('button', { name: text }))

    expect(emitted()).not.toHaveProperty('rendered')
    expect(emitted().insert).toEqual([
      [text, expect.not.objectContaining({ assignment: expect.anything() })]
    ])
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
    const previousMessages = structuredClone(i18n.global.getLocaleMessage('zh'))
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
})
