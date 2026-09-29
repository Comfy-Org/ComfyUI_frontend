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

const PROMPTS = [
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

  it('renders suggestions matched to cloud capabilities', () => {
    distribution.isCloud = true

    render(EmptyState, {
      global: { plugins: [i18n] }
    })

    const productAdPrompt = screen.getByRole('button', {
      name: 'Turn the product image into a short ad'
    })

    expect(productAdPrompt).toBeVisible()
    expect(screen.getByTestId('starter-prompt-icon-1')).toHaveClass(
      'icon-[lucide--video]'
    )
    expect(
      screen.queryByRole('button', {
        name: 'Help me install the missing nodes for this workflow'
      })
    ).not.toBeInTheDocument()
  })

  it('matches local-only prompt icons to their copy', () => {
    render(EmptyState, {
      global: { plugins: [i18n] }
    })

    const missingNodesPrompt = screen.getByRole('button', {
      name: 'Help me install the missing nodes for this workflow'
    })

    expect(missingNodesPrompt).toBeVisible()
    expect(screen.getByTestId('starter-prompt-icon-3')).toHaveClass(
      'icon-[lucide--puzzle]'
    )
  })

  it.for(PROMPTS.map((prompt, index) => ({ ...prompt, index })))(
    'identifies the $id chip by its slot, not its text',
    async ({ id, text, index }) => {
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

    await user.click(screen.getByRole('button', { name: PROMPTS[0].text }))
    await user.click(screen.getByRole('button', { name: PROMPTS[1].text }))

    expect(
      emitted().insert.map((call) => (call as unknown[])[1])
    ).toMatchObject([{ promptId: 'slot_1' }, { promptId: 'slot_2' }])
  })

  it('distinguishes the copy a click was made against, without carrying it', async () => {
    const user = userEvent.setup()
    const { emitted } = render(EmptyState, { global: { plugins: [i18n] } })

    await user.click(screen.getByRole('button', { name: PROMPTS[1].text }))

    const [[, attribution]] = emitted().insert as [
      string,
      { [k: string]: unknown }
    ][]
    expect(attribution.promptTextHash).toBe('ebed5d67')
    expect(attribution.promptTextHash).not.toBe('90a652b3')
    expect(Object.values(attribution)).not.toContain(PROMPTS[1].text)
  })

  it('attributes the displayed localized copy and locale together', async () => {
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
            locale: 'zh'
          })
        ]
      ])
    } finally {
      i18n.global.locale.value = previousLocale
    }
  })
})
