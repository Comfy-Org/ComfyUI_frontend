import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ExploreResultCard from './ExploreResultCard.vue'

const still = {
  name: 'Relight',
  thumbnail: { url: '/still.jpg', kind: 'image' }
} as const

describe('ExploreResultCard', () => {
  it.for([
    { art: 'a still', model: still, images: ['/still.jpg'] },
    { art: 'nothing', model: undefined, images: [] }
  ] as const)(
    'reads as its name and its pills with $art',
    ({ model, images }) => {
      render(ExploreResultCard, {
        props: {
          href: '/hub/workflows/relight/',
          kind: 'workflow',
          name: 'Relight',
          pills: ['Edit images'],
          model
        }
      })

      expect(screen.getByRole('link')).toHaveTextContent(
        /^\s*Workflow\s*Relight\s*Edit images\s*$/
      )
      expect(
        screen.queryAllByAltText('').map((img) => img.getAttribute('src'))
      ).toEqual(images)
    }
  )

  it('marks its kind top left and its maker top right over the artwork', () => {
    render(ExploreResultCard, {
      props: {
        href: '/hub/models/beeble/',
        kind: 'model',
        name: 'Beeble SwitchX',
        model: still,
        source: 'Beeble',
        logo: '/logos/beeble.svg',
        pills: ['Edit images']
      }
    })

    const artwork = within(screen.getByTestId('explore-artwork'))
    const meta = within(screen.getByTestId('explore-meta'))
    expect(artwork.getByTestId('explore-kind')).toHaveTextContent('Model')
    expect(artwork.getByTestId('explore-kind')).toHaveClass('top-4', 'left-4')
    expect(artwork.getByTestId('explore-source')).toHaveTextContent('Beeble')
    expect(artwork.getByTestId('explore-source')).toHaveClass(
      'top-4',
      'right-4'
    )
    expect(artwork.getByTestId('model-card-provider-logo')).toHaveStyle({
      maskImage: 'url(/logos/beeble.svg)'
    })
    expect(
      within(meta.getByTestId('explore-pills'))
        .getAllByText(/./)
        .map((pill) => pill.textContent.trim())
    ).toEqual(['Edit images'])
    expect(screen.getByRole('link')).toHaveTextContent(
      /^\s*Model\s*Beeble\s*Beeble SwitchX\s*Edit images\s*$/
    )
  })

  it('names the maker over the artwork when it has no logo', () => {
    render(ExploreResultCard, {
      props: { kind: 'workflow', name: 'Relight', source: 'Nobody', pills: [] }
    })

    expect(screen.getByTestId('explore-source')).toHaveTextContent('Nobody')
    expect(screen.queryByTestId('model-card-provider-logo')).toBeNull()
  })

  it('shows the kind as an icon and keeps its name for screen readers', () => {
    render(ExploreResultCard, {
      props: { kind: 'model', name: 'Beeble SwitchX', model: still, pills: [] }
    })

    expect(screen.getByText('Model')).toHaveClass('sr-only')
  })

  it.for([
    {
      href: '/hub/apps/cinematic-studio/',
      newTab: true,
      links: 1,
      target: '_blank'
    },
    {
      href: '/hub/workflows/relight/',
      newTab: false,
      links: 1,
      target: undefined
    },
    { href: undefined, newTab: true, links: 0, target: undefined }
  ])(
    'opens an app in a tab of its own, and nothing for one still coming ($href)',
    ({ href, newTab, links, target }) => {
      render(ExploreResultCard, {
        props: { href, newTab, kind: 'app', name: 'Relight', pills: [] }
      })

      expect(screen.queryAllByRole('link')).toHaveLength(links)
      expect(
        screen.getByTestId('explore-result').getAttribute('target') ?? undefined
      ).toBe(target)
    }
  )
})
