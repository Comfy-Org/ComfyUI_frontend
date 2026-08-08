import type { Meta, StoryObj } from '@storybook/vue3-vite'

import TeamGrid01 from './TeamGrid01.vue'

const avatarSrc = '/assets/images/fallback-gradient-avatar.svg'

const people = [
  {
    id: 'person-1',
    name: 'Placeholder One',
    avatarSrc,
    description:
      'Feature film background with ComfyUI on the back end of shipped work. Built production pipelines for studios and creative teams, from pitch through final delivery.',
    workflowsHref: '#'
  },
  {
    id: 'person-2',
    name: 'Placeholder Two',
    avatarSrc,
    description:
      'Commercial and experiential work, from pitch to final delivery. Combines visual direction with the engineering required to deliver reliably on fixed deadlines.',
    workflowsHref: '#'
  },
  {
    id: 'person-3',
    name: 'Placeholder Three',
    avatarSrc,
    description:
      'Production pipelines and creative tooling for in-house teams. Turns one-off experiments into workflows a team can run without help.',
    workflowsHref: '#'
  }
]

const meta: Meta<typeof TeamGrid01> = {
  title: 'Website/Blocks/TeamGrid01',
  component: TeamGrid01,
  tags: ['autodocs'],
  args: {
    heading: 'Featured technologists',
    lead: 'FDCTs come from real production: feature film, commercial, and experiential backgrounds, with ComfyUI on the back end of shipped work. We match technologists to each engagement based on the work, your stack, and the timeline.',
    people,
    closeLabel: 'Close',
    workflowsLabel: 'See their work'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CardsOnly: Story = {
  args: { heading: undefined, lead: undefined }
}

export const WithoutWorkflowsLink: Story = {
  args: {
    people: people.map((person) => ({ ...person, workflowsHref: undefined }))
  }
}
