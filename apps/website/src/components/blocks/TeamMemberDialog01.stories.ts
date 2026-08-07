import type { Meta, StoryObj } from '@storybook/vue3-vite'

import TeamMemberDialog01 from './TeamMemberDialog01.vue'

const bio = [
  "Doug is a Creative Technologist, VFX Supervisor, and educator who has spent his career in the messy middle where the creative team knows what they want but the pipeline doesn't yet know how to build it. His credits include The Book of Life, SCOOB!, and Netflix's Thelma the Unicorn, plus work for Universal Studios, Warner Bros., Netflix, and Samsung. He studied Visual Effects and Film & Television at Savannah College of Art and Design, then spent much of his career at Reel FX, eventually supervising compositing and matte painting teams.",
  "That artist-engineer combination pulled him into AI and creative technology. At xAI, he worked on the Human Data team, training and evaluating frontier AI systems from a working artist's perspective. At Groove Jones, he built AI, VFX, real-time, and interactive pipelines for experiential projects, including ComfyUI-powered generative systems and AI experiences for the NCAA, Bandai Namco, and the US Army. He also works with brands like Amazon, Asteria, Crocs, and Apple, using generative techniques to hit high-end results in hybrid pipelines while keeping artists in control.",
  'Today Doug is a Forward Deployed Creative Technologist at Comfy, plugging ComfyUI directly into VFX and studio production pipelines: figuring out what new models can do, building workflows around them, and translating that into tools artists can use without losing control.',
  "He's also a longtime Nuke compositor and pipeline builder, writing Python-based tools and training ML models to automate repetitive work. He teaches VFX, Nuke, and generative AI through fxphd, ActionVFX, and other platforms. It's a tool!"
]

const meta: Meta<typeof TeamMemberDialog01> = {
  title: 'Website/Blocks/TeamMemberDialog01',
  component: TeamMemberDialog01,
  tags: ['autodocs'],
  args: {
    name: 'Doug Hogan',
    avatarSrc: '/assets/images/fallback-gradient-avatar.svg',
    bio,
    workflowsHref: '#',
    workflowsLabel: 'See workflows',
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
