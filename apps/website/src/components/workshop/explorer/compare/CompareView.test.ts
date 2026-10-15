import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
import type { SamePromptSample } from '@/data/compareSamePrompt'
import CompareView from './CompareView.vue'

function hosted(slug: string, name: string): WorkshopModel {
  return {
    slug,
    name,
    workflowCount: 0,
    href: `/hub/models/${slug}/`,
    routerId: `acme/${slug}`,
    capabilities: [],
    provider: 'Acme'
  }
}

const models = [
  hosted('seedream', 'Seedream'),
  hosted('flux', 'Flux'),
  hosted('gpt', 'GPT Image')
]

const samples: SamePromptSample[] = [
  {
    type: 'portraits',
    prompt: 'A fisherman',
    source: 'magnific',
    images: { seedream: '/s-face.webp', flux: '/f-face.webp' }
  },
  {
    type: 'typography',
    prompt: 'A poster',
    source: 'magnific',
    images: { seedream: '/s-poster.webp', gpt: '/g-poster.webp' }
  },
  {
    type: 'product',
    prompt: 'A bottle',
    source: 'magnific',
    images: { flux: '/f-bottle.webp', veo: '/v-bottle.webp' }
  }
]

function promptRows() {
  return screen.queryAllByTestId('compare-prompt-row').map((row) =>
    within(row)
      .getByRole('rowheader')
      .textContent.replace(/^\s*Prompt\s*/, '')
      .trim()
  )
}

describe('CompareView', () => {
  it('offers only the prompt types two compared models answered', () => {
    render(CompareView, { props: { models, samples } })

    expect(
      within(screen.getByRole('group', { name: 'Prompt types' }))
        .getAllByRole('button')
        .map((button) => button.textContent.trim())
    ).toEqual(['All', 'Portraits', 'Typography'])
    expect(promptRows()).toEqual(['A fisherman', 'A poster'])
  })

  it('shows each model its own output for the same prompt and says when one has none', async () => {
    const user = userEvent.setup()
    render(CompareView, { props: { models, samples } })
    await user.click(screen.getByRole('button', { name: 'Typography' }))

    expect(promptRows()).toEqual(['A poster'])
    const [row] = screen.getAllByTestId('compare-prompt-row')
    expect(
      within(row).getByRole('img', {
        name: 'Seedream output for: A poster'
      })
    ).toHaveAttribute('src', '/s-poster.webp')
    expect(within(row).getByText('No sample for this prompt')).toBeTruthy()
  })

  it('leaves the same-prompt section out when no prompt has two answers', () => {
    render(CompareView, {
      props: { models: [models[1], models[2]], samples }
    })

    expect(screen.queryByRole('group', { name: 'Prompt types' })).toBeNull()
    expect(promptRows()).toEqual([])
  })

  it('offers API only for a model that has it', () => {
    render(CompareView, {
      props: {
        models: [
          ...models,
          { ...hosted('wan', 'Wan'), incompleteReason: 'missing-input-schema' }
        ],
        samples: []
      }
    })

    expect(
      screen
        .getAllByRole('link', { name: / API$/ })
        .map((link) => link.getAttribute('aria-label'))
    ).toEqual(['Seedream API', 'Flux API', 'GPT Image API'])
  })

  it('keeps the title, Add model and Copy link to the catalogue view', async () => {
    const user = userEvent.setup()
    const { emitted, rerender } = render(CompareView, {
      props: { models, samples: [], toolbar: true, removable: true }
    })

    expect(
      screen.getByRole('heading', { level: 2, name: /^Compare 3 models/ })
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Add model' }))
    await user.click(
      screen.getByRole('button', { name: 'Remove Flux from compare' })
    )
    expect(emitted('add')).toHaveLength(1)
    expect(emitted('remove')).toEqual([['flux']])

    await rerender({ models, samples: [], toolbar: false, removable: false })
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull()
  })
})
