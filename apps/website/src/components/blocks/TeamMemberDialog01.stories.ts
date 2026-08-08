import type { Meta, StoryObj } from '@storybook/vue3-vite'

import TeamMemberDialog01 from './TeamMemberDialog01.vue'

const description =
  "Doug's work spans Netflix, Universal Studios, Warner Bros., and Samsung, with deep expertise in VFX and studio production. As a Nuke compositor and Python tool builder, he teaches VFX, Nuke, and generative AI."

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
    creator: {
      name: 'Doug Hogan',
      avatarSrc: '/assets/images/fallback-gradient-avatar.svg',
      href: '#'
    },
    tags: ['Image Generation', 'Video']
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
    creator: {
      name: 'Doug Hogan',
      avatarSrc: '/assets/images/fallback-gradient-avatar.svg',
      href: '#'
    },
    tags: ['Image Generation', 'Video']
  },
  {
    id: 'workflow-3',
    title: 'Adjustment Frame Workflow',
    href: '#',
    media: {
      type: 'video' as const,
      src: 'https://comfy-hub-assets.comfy.org/uploads/a643e6f2-f91e-450f-871c-4c99116193f0.mp4',
      alt: 'Adjustment Frame Workflow'
    },
    creator: {
      name: 'Doug Hogan',
      avatarSrc: '/assets/images/fallback-gradient-avatar.svg',
      href: '#'
    },
    tags: []
  }
]

const meta: Meta<typeof TeamMemberDialog01> = {
  title: 'Website/Blocks/TeamMemberDialog01',
  component: TeamMemberDialog01,
  tags: ['autodocs'],
  args: {
    name: 'Doug Hogan',
    avatarSrc: '/assets/images/fallback-gradient-avatar.svg',
    description,
    workflows,
    workflowsHref: '#',
    workflowsLabel: 'See their work',
    tryNowLabel: 'Try now',
    closeLabel: 'Close',
    defaultOpen: true
  },
  render: (args) => ({
    components: { TeamMemberDialog01 },
    setup: () => ({ args }),
    template: `
      <TeamMemberDialog01 v-bind="args">
        <template #trigger>
          <button
            class="bg-primary-comfy-yellow text-primary-comfy-ink cursor-pointer rounded-2xl px-6 py-3 text-sm font-semibold"
          >
            View bio
          </button>
        </template>
      </TeamMemberDialog01>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutWorkflowsLink: Story = {
  args: { workflowsHref: undefined, workflowsLabel: undefined }
}

export const WithoutWorkflows: Story = {
  args: { workflows: [] }
}
