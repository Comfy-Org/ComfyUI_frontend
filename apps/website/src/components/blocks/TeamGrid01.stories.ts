import type { Meta, StoryObj } from '@storybook/vue3-vite'

import TeamGrid01 from './TeamGrid01.vue'

const avatarSrc = '/assets/images/fallback-gradient-avatar.svg'

const workflows = [
  {
    id: 'workflow-1',
    title: 'LTX Cleanplate for VFX',
    href: '#',
    media: {
      type: 'video' as const,
      src: 'https://comfy-hub-assets.comfy.org/uploads/8a3a846f-5017-428e-b2a2-24025c55e884.mp4',
      alt: 'LTX Cleanplate for VFX'
    },
    description:
      'Generate clean plates for VFX compositing with LTX, removing subjects while keeping the shot intact.',
    tags: ['VFX']
  },
  {
    id: 'workflow-2',
    title: 'VFX Utilities',
    href: '#',
    media: {
      type: 'video' as const,
      src: 'https://comfy-hub-assets.comfy.org/uploads/fd38a7e9-0d2a-4d6a-9d6a-b04bbce294cc.mp4',
      alt: 'VFX Utilities'
    },
    description:
      'A utility kit for VFX shots: passes, mattes, and helpers for image and video work.',
    tags: ['Image Generation', 'Video']
  }
]

// person-1 exercises the dialog's workflow grid; the others cover the
// empty-workflow state.
const people = [
  {
    id: 'person-1',
    name: 'Placeholder One',
    avatarSrc,
    description:
      'Feature film background with ComfyUI on the back end of shipped work. Built production pipelines for studios and creative teams, from pitch through final delivery.',
    ctaLabel: 'See Placeholder’s work',
    tags: ['Entertainment', 'VFX'],
    workflows
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
    heading: 'Featured creatives',
    lead: 'Forward Deployed Creatives come from real production: feature film, commercial, and experiential backgrounds, with ComfyUI on the back end of shipped work. We match creatives to each engagement based on the work, your stack, and the timeline.',
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

export const WithoutWorkflows: Story = {
  args: {
    people: people.map((person) => ({ ...person, workflows: undefined }))
  }
}
