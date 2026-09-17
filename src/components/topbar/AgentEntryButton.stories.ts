import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AgentEntryButton from './AgentEntryButton.vue'

const meta: Meta<typeof AgentEntryButton> = {
  title: 'Components/Button/AgentEntryButton',
  component: AgentEntryButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The agent entry point in the topbar. Idle, it sweeps a shine around its outline; hovering turns the icon a full circle. Both effects are suppressed under `prefers-reduced-motion`.'
      }
    }
  },
  argTypes: {
    active: {
      control: 'boolean',
      description: 'Panel is open — swaps the shine for a pressed fill'
    }
  },
  args: {
    active: false
  }
}
export default meta

type Story = StoryObj<typeof AgentEntryButton>

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Idle. The outline shine sweeps right to left, snaps back faster, then rests before repeating. Hover for a full turn clockwise, unwinding counter-clockwise on release — quicker on the way back (300ms vs 500ms). Because it is a transition rather than a keyframe animation, leaving mid-turn reverses from wherever it is instead of finishing.'
      }
    }
  }
}

export const Active: Story = {
  args: { active: true },
  parameters: {
    docs: {
      description: {
        story:
          'Panel open. The outline shine stops so the topbar is not animating while the agent is in use; the icon still turns on hover.'
      }
    }
  }
}
