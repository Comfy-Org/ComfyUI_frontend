import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type {
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import ExploreCatalogue from './ExploreCatalogue.vue'

vi.mock(import('@/scripts/posthog'))

const workflows: WorkflowWorkshopModel[] = [
  {
    type: 'CLOUD',
    workflowId: 'match-lighting',
    slug: 'workflows/match-lighting',
    name: 'Match lighting from a reference',
    href: '/hub/workflows/match-lighting/',
    workflowCount: 0,
    capabilities: [],
    useCases: ['edit-images'],
    models: ['Qwen Image Edit'],
    summary: 'Relight a portrait using the lighting of a reference image.'
  }
]

const models: WorkshopModel[] = ['image', 'video'].map((kind) => ({
  routerId: `beeble/switchx-${kind}`,
  slug: `beeble-switchx-${kind}`,
  name: `Beeble SwitchX ${kind}`,
  href: `/hub/models/beeble-switchx-${kind}/`,
  provider: 'Beeble',
  workflowCount: 0,
  capabilities: ['relighting'],
  useCases: [kind === 'image' ? 'edit-images' : 'edit-videos']
}))

const apps: CatalogueApp[] = [
  {
    key: 'apps/cinematic-studio',
    name: 'Cinematic Studio',
    task: 'Direct every shot.',
    href: '/hub/apps/cinematic-studio/'
  }
]

async function search(query: string, shownApps = apps) {
  render(ExploreCatalogue, {
    props: { apps: shownApps, workflows, models }
  })
  await userEvent.setup().type(screen.getByTestId('explore-search'), query)
}

const results = () => within(screen.getByTestId('explore-results'))

describe('ExploreCatalogue search', () => {
  it('finds models, workflows and apps alike, and counts each kind', async () => {
    await search('relight')

    expect(
      results()
        .getAllByTestId('explore-kind')
        .map((tag) => tag.dataset.kind)
    ).toEqual(['workflow', 'app', 'model', 'model'])
    expect(
      within(results().getByTestId('explore-counts'))
        .getAllByRole('link')
        .map((link) => [link.textContent.trim(), link.getAttribute('href')])
    ).toEqual([
      ['2 models', '/hub/models/?q=relight'],
      ['1 workflow', '/hub/workflows/?q=relight'],
      ['1 app', '/hub/apps/']
    ])
  })

  it('shows a coming app dimmed and unlinked, an open one in a new tab', async () => {
    await search('studio')

    expect(
      results().getByRole('link', { name: /Cinematic Studio/ })
    ).toHaveAttribute('target', '_blank')

    const box = screen.getByTestId('explore-search')
    const user = userEvent.setup()
    await user.clear(box)
    await user.type(box, 'relight')
    const soon = results()
      .getAllByTestId('explore-result')
      .find((card) => card.textContent.includes('Relight'))
    expect(soon).toHaveAttribute('aria-disabled', 'true')
    expect(soon).toHaveTextContent('Soon')
  })

  it('names who makes each result and leaves Run and API to its page', async () => {
    await search('beeble')

    for (const card of results().getAllByTestId('explore-result')) {
      expect(card).not.toHaveTextContent(/\b(Run|API)\b/)
      expect(within(card).getByTestId('explore-source')).toHaveTextContent(
        'Beeble'
      )
    }
  })

  it('keeps the coming apps out of a search while the apps are closed', async () => {
    await search('relight', [])

    expect(
      results()
        .getAllByTestId('explore-kind')
        .map((tag) => tag.dataset.kind)
    ).toEqual(['workflow', 'model', 'model'])
  })
})
