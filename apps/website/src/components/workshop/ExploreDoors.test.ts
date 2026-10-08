import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ExploreDoors from './ExploreDoors.vue'

const ALL = { models: 3, workflows: 2, apps: 1 }

describe('ExploreDoors', () => {
  it('says who each door is for', () => {
    render(ExploreDoors, { props: { counts: ALL } })

    expect(
      screen
        .getAllByRole('link')
        .map((door) => [
          within(door).getByTestId('explore-door-intent').textContent.trim(),
          within(door).getByTestId('explore-door-hint').textContent.trim()
        ])
    ).toEqual([
      [
        'For developers',
        'Call the latest models from your code. Try them here first.'
      ],
      ['For ComfyUI users', 'Open the graph and change any step.'],
      ['For creators', 'Upload, click, done. No nodes, no setup.']
    ])
  })

  it.for([
    {
      door: 'models',
      copy: ['Alpine lake at blue hour', 'Nano Banana Pro', 'Run']
    },
    {
      door: 'workflows',
      copy: ['Relight', 'light', '45°', 'strength', '0.80', 'Save Image']
    },
    {
      door: 'apps',
      copy: ['Focal length', '35mm', 'Generate']
    }
  ] as const)('shows the $door interface over its image', ({ door, copy }) => {
    render(ExploreDoors, {
      props: {
        counts: ALL,
        art: {
          models: {
            src: '/lake.png',
            name: 'Nano Banana Pro',
            provider: 'Google',
            usd: 0.03,
            credits: 6,
            prompt: 'workshop.explore.doorModelPromptLake'
          },
          workflows: { src: '/bottle.webp' },
          apps: {
            src: '/studio.jpg',
            control: 'workshop.explore.doorAppControlFocal',
            value: '35mm'
          }
        }
      }
    })

    const art = within(
      within(screen.getByTestId(`explore-door-${door}`)).getByTestId(
        'explore-door-art'
      )
    )
    for (const text of copy) expect(art.getByText(text)).toBeInTheDocument()
  })

  it('keeps a door without art to its words', () => {
    render(ExploreDoors, { props: { counts: ALL } })

    expect(screen.queryByTestId('explore-door-art')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Models/ })).toHaveAttribute(
      'href',
      '/hub/models/'
    )
  })
})
