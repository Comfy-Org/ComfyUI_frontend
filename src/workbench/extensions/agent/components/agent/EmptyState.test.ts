import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import { starterPromptTextHash } from '../../utils/starterPrompts'
import EmptyState from './EmptyState.vue'

const distribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

const PROMPTS = [
  {
    id: 'generate_image',
    text: 'Build a workflow using my installed models'
  },
  { id: 'list_workflows', text: 'Fix the errors in this workflow' },
  { id: 'find_workflow', text: "Improve this workflow's image quality" },
  { id: 'explain_selected_node', text: 'Explain the selected node' },
  {
    id: 'build_video_workflow',
    text: 'Help me install the missing nodes for this workflow'
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
    const prompt = 'Help me install the missing nodes for this workflow'
    const suggestion = screen.getByRole('button', { name: prompt })

    expect(screen.getAllByRole('button')).toHaveLength(5)

    await user.click(suggestion)

    expect(emitted().insert).toEqual([
      [
        prompt,
        {
          promptId: 'build_video_workflow',
          promptIndex: 4,
          promptCount: 5,
          promptTextHash: starterPromptTextHash(prompt),
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

    expect(
      screen.getByRole('button', {
        name: 'Turn an image into a short video'
      })
    ).toBeVisible()
    expect(
      screen.queryByRole('button', {
        name: 'Help me install the missing nodes for this workflow'
      })
    ).not.toBeInTheDocument()
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
    ).toMatchObject([
      { promptId: 'generate_image' },
      { promptId: 'list_workflows' }
    ])
  })

  it('distinguishes the copy a click was made against, without carrying it', async () => {
    const user = userEvent.setup()
    const { emitted } = render(EmptyState, { global: { plugins: [i18n] } })

    await user.click(screen.getByRole('button', { name: PROMPTS[1].text }))

    const [[, attribution]] = emitted().insert as [
      string,
      { [k: string]: unknown }
    ][]
    expect(attribution.promptTextHash).toBe(
      starterPromptTextHash(PROMPTS[1].text)
    )
    expect(attribution.promptTextHash).not.toBe(
      starterPromptTextHash(`${PROMPTS[1].text} (reworded)`)
    )
    expect(Object.values(attribution)).not.toContain(PROMPTS[1].text)
  })
})
