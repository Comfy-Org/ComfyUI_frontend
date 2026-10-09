import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopModel } from '@/config/models-catalogue'
import ModelCompare from './ModelCompare.vue'

function hosted(slug: string, name: string): WorkshopModel {
  return {
    slug,
    name,
    workflowCount: 0,
    href: `/hub/models/${slug}/`,
    routerId: `acme/${slug}`,
    capabilities: [],
    provider: name
  }
}

const model = hosted('seedream', 'Seedream')
const candidates = [hosted('flux', 'Flux'), hosted('gpt', 'GPT Image')]

function columns() {
  return screen
    .getAllByRole('columnheader')
    .map((column) => column.getAttribute('aria-label'))
}

describe('ModelCompare', () => {
  it('sets the model beside the chip that is picked and links the full comparison', async () => {
    const user = userEvent.setup()
    render(ModelCompare, { props: { model, candidates } })

    expect(
      screen.getByRole('heading', { level: 2, name: 'How it compares' })
    ).toBeTruthy()
    const chips = within(screen.getByRole('group', { name: 'Compare with' }))
    expect(chips.getByRole('button', { name: 'Flux' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(columns()).toEqual(['Seedream', 'Flux'])

    await user.click(chips.getByRole('button', { name: 'GPT Image' }))
    expect(columns()).toEqual(['Seedream', 'GPT Image'])
    expect(screen.getByRole('row', { name: /^Provider/ })).toHaveTextContent(
      'ProviderSeedreamGPT Image'
    )
    expect(
      screen.getByRole('link', { name: 'Open full comparison' })
    ).toHaveAttribute('href', '/hub/models/?compare=seedream,gpt')
  })

  it.for([
    ['no other model to compare with', model, []],
    [
      'a model that cannot be compared',
      { ...model, incompleteReason: 'missing-input-schema' as const },
      candidates
    ]
  ] as const)('stays out of the page for %s', ([, own, others]) => {
    render(ModelCompare, { props: { model: own, candidates: others } })
    expect(screen.queryByTestId('model-compare')).toBeNull()
  })
})
