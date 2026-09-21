import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { AskUserPart } from '../../../services/agent/agentMessageParts'

import AskUserCard from './AskUserCard.vue'

const meta: Meta<typeof AskUserCard> = {
  title: 'Workbench/Agent/AskUserCard',
  component: AskUserCard,
  parameters: { layout: 'centered' },
  globals: { theme: 'dark' },
  argTypes: { onAnswer: { action: 'answer' } }
}

export default meta
type Story = StoryObj<typeof meta>

const renderAtMinimumWidth: Story['render'] = (args) => ({
  components: { AskUserCard },
  setup: () => ({ args }),
  template: '<div class="w-[372px]"><AskUserCard v-bind="args" /></div>'
})

const part = (ask: Partial<AskUserPart>): AskUserPart => ({
  type: 'askUser',
  askId: 'turn-1:call-1',
  prompt: 'Which aspect ratio should the poster use?',
  options: [
    { id: 'square', label: 'Square (1:1)' },
    { id: 'portrait', label: 'Portrait (2:3)' },
    { id: 'landscape', label: 'Landscape (16:9)' }
  ],
  minSelections: 1,
  maxSelections: 1,
  allowOther: false,
  ...ask
})

const models: AskUserPart['options'] = [
  {
    id: 'sdxl',
    label: 'SDXL',
    description: 'Fast at 1024px with a broad style range and many LoRAs.'
  },
  {
    id: 'flux',
    label: 'Flux Dev',
    description:
      'Best prompt adherence and legible text, slower and heavier on VRAM.'
  },
  {
    id: 'sd35',
    label: 'SD 3.5 Large',
    description: 'Good composition for complex scenes.'
  },
  { id: 'sd15', label: 'SD 1.5' }
]

export const SingleChoice: Story = {
  args: { part: part({}) },
  render: renderAtMinimumWidth
}

export const MultiChoiceWithDescriptions: Story = {
  args: {
    part: part({
      prompt: 'Which models should I compare? Pick up to two.',
      options: models,
      maxSelections: 2
    })
  },
  render: renderAtMinimumWidth
}

export const AllowOther: Story = {
  args: {
    part: part({
      prompt: 'Which style should I aim for?',
      options: [
        { id: 'photo', label: 'Photoreal' },
        { id: 'anime', label: 'Anime', description: 'Clean lines, flat color' }
      ],
      allowOther: true
    })
  },
  render: renderAtMinimumWidth
}

export const MultiChoiceWithOther: Story = {
  args: {
    part: part({
      prompt: 'Which outputs do you want?',
      options: models,
      minSelections: 2,
      maxSelections: 3,
      allowOther: true
    })
  },
  render: renderAtMinimumWidth
}

export const Answering: Story = {
  args: { ...MultiChoiceWithDescriptions.args, answering: true },
  render: renderAtMinimumWidth
}
