import type { Meta, StoryObj } from '@storybook/vue3-vite'

import TeamGrid01 from './TeamGrid01.vue'

const avatarSrc = '/assets/images/fallback-gradient-avatar.svg'

const people = [
  {
    id: 'person-1',
    name: 'Placeholder One',
    description:
      'Feature film background with ComfyUI on the back end of shipped work.',
    avatarSrc
  },
  {
    id: 'person-2',
    name: 'Placeholder Two',
    description:
      'Commercial and experiential work, from pitch to final delivery.',
    avatarSrc
  },
  {
    id: 'person-3',
    name: 'Placeholder Three',
    description:
      'Production pipelines and creative tooling for in-house teams.',
    avatarSrc
  }
]

const meta: Meta<typeof TeamGrid01> = {
  title: 'Website/Blocks/TeamGrid01',
  component: TeamGrid01,
  tags: ['autodocs'],
  args: {
    heading: 'Featured technologists',
    lead: 'FDCTs come from real production: feature film, commercial, and experiential backgrounds, with ComfyUI on the back end of shipped work. We match technologists to each engagement based on the work, your stack, and the timeline.',
    people
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CardsOnly: Story = {
  args: { heading: undefined, lead: undefined }
}

export const WithBackdropImages: Story = {
  args: {
    people: people.map((person) => ({
      ...person,
      imageSrc: avatarSrc,
      imageAlt: ''
    }))
  }
}
