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

  it('says what kind it is, who makes it, and what it does', () => {
    render(ExploreResultCard, {
      props: {
        href: '/hub/models/beeble/',
        kind: 'model',
        name: 'Beeble SwitchX',
        model: still,
        source: 'Beeble',
        pills: ['Edit images']
      }
    })

    const pills = within(screen.getByTestId('explore-pills'))
    expect(pills.queryByTestId('explore-kind')).toBeNull()
    expect(screen.getByTestId('explore-kind')).toHaveTextContent('Model')
    expect(screen.getByTestId('explore-source')).toHaveTextContent('Beeble')
    expect(
      pills.getAllByText(/./).map((pill) => pill.textContent.trim())
    ).toEqual(['Edit images'])
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
