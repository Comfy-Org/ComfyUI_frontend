import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import PrizeTiers01 from './PrizeTiers01.vue'

type PrizeTiersProps = ComponentProps<typeof PrizeTiers01>

const competitionProps = {
  heading: 'Prizes & Categories',
  mainLabel: 'Main prizes',
  grand: {
    id: 'best-overall',
    title: 'Best Overall',
    award: '$10,000',
    description: 'Best overall build. Every entry is automatically considered.'
  },
  categories: [
    {
      id: 'most-innovative',
      title: 'Most Innovative',
      award: 'GeForce RTX 5090',
      description:
        "An app that's never been done, novel custom node packs or uses of ComfyUI. Demo video must explain why the submission is innovative."
    },
    {
      id: 'most-viral',
      title: 'Most Viral',
      award: 'GeForce RTX 5090',
      description: 'Delightful to use and made to be shared.'
    },
    {
      id: 'open-weights-only',
      title: 'Open Weights Only',
      award: 'GeForce RTX 5090',
      description: 'No partner nodes or APIs, open-weights models only.'
    }
  ],
  runnerUp: {
    id: 'runner-ups',
    title: '10 Runner Ups',
    award: '$250 in Comfy Credits'
  },
  bonusLabel: 'OSS Ecosystem Bonuses',
  bonuses: [
    {
      id: 'ltx',
      title: 'VFX Workflow Built with LTX',
      award: '$2,000 cash',
      description:
        'LTX must be the core video model in the workflow to qualify.'
    },
    {
      id: 'flux',
      title: 'Built with FLUX',
      award: '$1,000 / $500 / $250 in Flux API credits',
      description:
        'FLUX3 must be the core video model in the workflow to qualify.'
    }
  ]
} satisfies PrizeTiersProps

function renderPrizeTiers(
  props: Partial<PrizeTiersProps> = {},
  slots: Record<string, string> = {}
) {
  return render(PrizeTiers01, {
    props: { ...competitionProps, ...props },
    slots
  })
}

function headingNames(level: number) {
  return screen
    .queryAllByRole('heading', { level })
    .map((heading) => heading.textContent.trim())
}

function prizeTexts() {
  return screen.getAllByRole('listitem').map((prize) =>
    within(prize)
      .getAllByText(/\S/)
      .map((text) => text.textContent.trim())
  )
}

function emptyElements() {
  return screen.queryAllByText(
    (_, element) => element?.textContent.trim() === ''
  )
}

describe('PrizeTiers01', () => {
  it.for([
    {
      name: 'both tier labels',
      bonuses: competitionProps.bonuses,
      tierLabels: ['Main prizes', 'OSS Ecosystem Bonuses'],
      prizeNames: [
        'Best Overall',
        'Most Innovative',
        'Most Viral',
        'Open Weights Only',
        '10 Runner Ups',
        'VFX Workflow Built with LTX',
        'Built with FLUX'
      ]
    },
    {
      name: 'only the main tier label when there are no bonuses',
      bonuses: [],
      tierLabels: ['Main prizes'],
      prizeNames: [
        'Best Overall',
        'Most Innovative',
        'Most Viral',
        'Open Weights Only',
        '10 Runner Ups'
      ]
    }
  ])(
    'outlines the module heading, $name and the prize names as headings',
    ({ bonuses, tierLabels, prizeNames }) => {
      renderPrizeTiers({ bonuses })

      expect(headingNames(2)).toEqual(['Prizes & Categories'])
      expect(headingNames(3)).toEqual(tierLabels)
      expect(headingNames(4)).toEqual(prizeNames)
    }
  )

  it.for([
    {
      name: 'the competition prizes',
      props: {},
      prizes: [
        [
          'Best Overall',
          '$10,000',
          'Best overall build. Every entry is automatically considered.'
        ],
        [
          'Most Innovative',
          'GeForce RTX 5090',
          "An app that's never been done, novel custom node packs or uses of ComfyUI. Demo video must explain why the submission is innovative."
        ],
        [
          'Most Viral',
          'GeForce RTX 5090',
          'Delightful to use and made to be shared.'
        ],
        [
          'Open Weights Only',
          'GeForce RTX 5090',
          'No partner nodes or APIs, open-weights models only.'
        ],
        ['10 Runner Ups', '$250 in Comfy Credits'],
        [
          'VFX Workflow Built with LTX',
          '$2,000 cash',
          'LTX must be the core video model in the workflow to qualify.'
        ],
        [
          'Built with FLUX',
          '$1,000 / $500 / $250 in Flux API credits',
          'FLUX3 must be the core video model in the workflow to qualify.'
        ]
      ]
    },
    {
      name: 'prizes that only sometimes have a description',
      props: {
        grand: { id: 'grand', title: 'Grand', award: '$5,000' },
        categories: [
          { id: 'speed', title: 'Speed', award: 'Laptop' },
          {
            id: 'craft',
            title: 'Craft',
            award: 'Monitor',
            description: 'Only craft explains itself.'
          }
        ],
        runnerUp: {
          id: 'honourable',
          title: 'Honourable mentions',
          award: 'Stickers',
          description: 'Five mentions.'
        },
        bonuses: [{ id: 'docs', title: 'Best docs', award: '$100 credits' }]
      },
      prizes: [
        ['Grand', '$5,000'],
        ['Speed', 'Laptop'],
        ['Craft', 'Monitor', 'Only craft explains itself.'],
        ['Honourable mentions', 'Stickers', 'Five mentions.'],
        ['Best docs', '$100 credits']
      ]
    }
  ] satisfies {
    name: string
    props: Partial<PrizeTiersProps>
    prizes: string[][]
  }[])(
    'lists $name with each title, award and only the descriptions given',
    ({ props, prizes }) => {
      renderPrizeTiers(props)

      expect(prizeTexts()).toEqual(prizes)
    }
  )

  it('leaves no empty element where descriptions and the call-to-action are absent', () => {
    renderPrizeTiers({
      grand: { id: 'grand', title: 'Grand', award: '$5,000' },
      categories: [{ id: 'speed', title: 'Speed', award: 'Laptop' }],
      runnerUp: {
        id: 'honourable',
        title: 'Honourable mentions',
        award: 'Stickers'
      },
      bonuses: [{ id: 'docs', title: 'Best docs', award: '$100 credits' }]
    })

    expect(emptyElements()).toEqual([])
  })

  it('renders the call-to-action content when the default slot is given', () => {
    renderPrizeTiers({}, { default: '<a href="/submit/">Submit a project</a>' })

    expect(
      screen.getByRole('link', { name: 'Submit a project' })
    ).toBeInTheDocument()
  })
})
