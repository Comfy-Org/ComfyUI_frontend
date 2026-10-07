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

  it('says what kind it is, who makes it, and how it can be used', () => {
    render(ExploreResultCard, {
      props: {
        href: '/hub/models/beeble/',
        kind: 'model',
        name: 'Beeble SwitchX',
        model: still,
        source: 'Beeble',
        pills: ['Edit images'],
        access: ['run', 'api']
      }
    })

    expect(screen.getByTestId('explore-kind')).toHaveTextContent('Model')
    expect(screen.getByTestId('explore-source')).toHaveTextContent('Beeble')
    expect(
      within(screen.getByTestId('explore-pills'))
        .getAllByText(/./)
        .map((pill) => pill.textContent.trim())
    ).toEqual(expect.arrayContaining(['Edit images', 'Run', 'API']))
  })

  it.for([
    { href: '/hub/apps/cinematic-studio/', links: 1, target: '_blank' },
    { href: undefined, links: 0, target: undefined }
  ])(
    'opens an app in a tab of its own, and nothing for one still coming ($href)',
    ({ href, links, target }) => {
      render(ExploreResultCard, {
        props: { href, newTab: true, kind: 'app', name: 'Relight', pills: [] }
      })

      expect(screen.queryAllByRole('link')).toHaveLength(links)
      expect(
        screen.getByTestId('explore-result').getAttribute('target') ?? undefined
      ).toBe(target)
    }
  )
})
