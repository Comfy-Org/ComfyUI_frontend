import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ContentDivider from './ContentDivider.vue'

const meta: Meta<typeof ContentDivider> = {
  title: 'Components/Common/ContentDivider',
  component: ContentDivider,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'ContentDivider provides a visual separation between content sections. It supports both horizontal and vertical orientations with customizable width/thickness.'
      }
    }
  },
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: 'Direction of the divider line',
      defaultValue: 'horizontal'
    },
    width: {
      control: { type: 'range', min: 0.1, max: 10, step: 0.1 },
      description: 'Width/thickness of the divider in pixels',
      defaultValue: 0.3
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof ContentDivider>

export const Horizontal: Story = {
  args: {
    orientation: 'horizontal',
    width: 0.3
  },
  parameters: {
    docs: {
      description: {
        story:
          'Default horizontal divider for separating content sections vertically.'
      }
    }
  },
  decorators: [
    () => ({
      template: `
        <div style="width: 300px; padding: 20px;">
          <div style="padding: 10px; background: rgba(100, 100, 100, 0.1); margin-bottom: 10px;">
            Content Section 1
          </div>
          <story />
          <div style="padding: 10px; background: rgba(100, 100, 100, 0.1); margin-top: 10px;">
            Content Section 2
          </div>
        </div>
      `
    })
  ]
}

export const Vertical: Story = {
  args: {
    orientation: 'vertical',
    width: 0.3
  },
  parameters: {
    docs: {
      description: {
        story: 'Vertical divider for separating content sections horizontally.'
      }
    }
  },
  decorators: [
    () => ({
      template: `
        <div style="height: 200px; display: flex; align-items: stretch; padding: 20px;">
          <div style="padding: 10px; background: rgba(100, 100, 100, 0.1); margin-right: 10px; flex: 1;">
            Left Content
          </div>
          <story />
          <div style="padding: 10px; background: rgba(100, 100, 100, 0.1); margin-left: 10px; flex: 1;">
            Right Content
          </div>
        </div>
      `
    })
  ]
}

export const ThickHorizontal: Story = {
  args: {
    orientation: 'horizontal',
    width: 2
  },
  parameters: {
    docs: {
      description: {
        story:
          'Thicker horizontal divider for more prominent visual separation.'
      }
    }
  },
  decorators: [
    () => ({
      template: `
        <div style="width: 300px; padding: 20px;">
          <div style="padding: 10px; background: rgba(100, 100, 100, 0.1); margin-bottom: 10px;">
            Content Section 1
          </div>
          <story />
          <div style="padding: 10px; background: rgba(100, 100, 100, 0.1); margin-top: 10px;">
            Content Section 2
          </div>
        </div>
      `
    })
  ]
}

export const ThickVertical: Story = {
  args: {
    orientation: 'vertical',
    width: 3
  },
  parameters: {
    docs: {
      description: {
        story: 'Thicker vertical divider for more prominent visual separation.'
      }
    }
  },
  decorators: [
    () => ({
      template: `
        <div style="height: 200px; display: flex; align-items: stretch; padding: 20px;">
          <div style="padding: 10px; background: rgba(100, 100, 100, 0.1); margin-right: 15px; flex: 1;">
            Left Content
          </div>
          <story />
          <div style="padding: 10px; background: rgba(100, 100, 100, 0.1); margin-left: 15px; flex: 1;">
            Right Content
          </div>
        </div>
      `
    })
  ]
}
