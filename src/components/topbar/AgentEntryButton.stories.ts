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
          'The agent entry point in the topbar. Hovering turns the icon a full circle. Until the user has opened the panel once, the outline also sweeps a shine to advertise it. Both effects are suppressed under `prefers-reduced-motion`.'
      }
    }
  },
  argTypes: {
    active: {
      control: 'boolean',
      description: 'Panel is open — swaps the shine for a pressed fill'
    },
    inviting: {
      control: 'boolean',
      description: 'User has never opened the panel — runs the outline shine'
    }
  },
  args: {
    active: false,
    inviting: false
  }
}
export default meta

type Story = StoryObj<typeof AgentEntryButton>

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'What a user sees once they have opened the panel at least once, which is the resting state for nearly the whole life of the app. Nothing moves until you point at it. Hover for a full turn clockwise, unwinding counter-clockwise on release — quicker on the way back (300ms vs 500ms). Because it is a transition rather than a keyframe animation, leaving mid-turn reverses from wherever it is instead of finishing.'
      }
    }
  }
}

export const Inviting: Story = {
  args: { inviting: true },
  parameters: {
    docs: {
      description: {
        story:
          'What a user sees before they have ever opened the panel. The outline shine sweeps right to left, snaps back faster, then rests before repeating. The panel records the first time it docks, so this state ends after one open and never returns.'
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
          'Panel open. The icon fills, so the pressed state reads without relying on the background alone. The outline shine stops as well, so the topbar is not animating while the agent is in use. The icon still turns on hover.'
      }
    }
  }
}
