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
    ctaLabel: 'See Placeholder’s work',
    tags: ['Entertainment', 'VFX']
  },
  {
    id: 'person-2',
    name: 'Placeholder Two',
    avatarSrc,
    description:
      'Commercial and experiential work, from pitch to final delivery. Combines visual direction with the engineering required to deliver reliably on fixed deadlines.',
    ctaLabel: 'See Placeholder’s work',
    tags: ['Generative AI', 'Production']
  },
  {
    id: 'person-3',
    name: 'Placeholder Three',
    avatarSrc,
    description:
      'Production pipelines and creative tooling for in-house teams. Turns one-off experiments into workflows a team can run without help.',
    ctaLabel: 'See Placeholder’s work',
    tags: ['Marketing', 'Advertising']
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
    closeLabel: 'Close'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CardsOnly: Story = {
  args: { heading: undefined, lead: undefined }
}
