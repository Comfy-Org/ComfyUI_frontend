import type { Meta, StoryObj } from '@storybook/vue3-vite'

import TextDivider from './TextDivider.vue'

const meta: Meta<typeof TextDivider> = {
  title: 'Components/Common/TextDivider',
  component: TextDivider,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'TextDivider combines text with a PrimeVue divider to create labeled section separators. The text can be positioned on either side of the divider line with various styling options.'
      }
    }
  },
  argTypes: {
    text: {
      control: 'text',
      description: 'Text content to display alongside the divider',
      defaultValue: 'Section'
    },
    position: {
      control: 'select',
      options: ['left', 'right'],
      description: 'Position of text relative to the divider',
      defaultValue: 'left'
    },
    align: {
      control: 'select',
      options: ['left', 'center', 'right', 'top', 'bottom'],
      description: 'Alignment of the divider line',
      defaultValue: 'center'
    },
    type: {
      control: 'select',
      options: ['solid', 'dashed', 'dotted'],
      description: 'Style of the divider line',
      defaultValue: 'solid'
    },
    layout: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: 'Layout direction of the divider',
      defaultValue: 'horizontal'
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof TextDivider>

export const Default: Story = {
  args: {
    text: 'Section Title',
    position: 'left',
    align: 'center',
    type: 'solid',
    layout: 'horizontal'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Default text divider with text on the left side of a solid horizontal line.'
      }
    }
  },
  decorators: [
    () => ({
      template: `
        <div style="width: 400px; padding: 20px;">
          <div style="padding: 15px; background: rgba(100, 100, 100, 0.1); margin-bottom: 15px;">
            Content above divider
          </div>
          <story />
          <div style="padding: 15px; background: rgba(100, 100, 100, 0.1); margin-top: 15px;">
            Content below divider
          </div>
        </div>
      `
    })
  ]
}

export const RightPosition: Story = {
  args: {
    text: 'Section Title',
    position: 'right',
    align: 'center',
    type: 'solid',
    layout: 'horizontal'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Text divider with text positioned on the right side of the line.'
      }
    }
  },
  decorators: [
    () => ({
      template: `
        <div style="width: 400px; padding: 20px;">
          <div style="padding: 15px; background: rgba(100, 100, 100, 0.1); margin-bottom: 15px;">
            Content above divider
          </div>
          <story />
          <div style="padding: 15px; background: rgba(100, 100, 100, 0.1); margin-top: 15px;">
            Content below divider
          </div>
        </div>
      `
    })
  ]
}

export const DashedStyle: Story = {
  args: {
    text: 'Dashed Section',
    position: 'left',
    align: 'center',
    type: 'dashed',
    layout: 'horizontal'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Text divider with a dashed line style for a softer visual separation.'
      }
    }
  },
  decorators: [
    () => ({
      template: `
        <div style="width: 400px; padding: 20px;">
          <div style="padding: 15px; background: rgba(100, 100, 100, 0.1); margin-bottom: 15px;">
            Content above divider
          </div>
          <story />
          <div style="padding: 15px; background: rgba(100, 100, 100, 0.1); margin-top: 15px;">
            Content below divider
          </div>
        </div>
      `
    })
  ]
}

export const DottedStyle: Story = {
  args: {
    text: 'Dotted Section',
    position: 'right',
    align: 'center',
    type: 'dotted',
    layout: 'horizontal'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Text divider with a dotted line style for subtle content separation.'
      }
    }
  },
  decorators: [
    () => ({
      template: `
        <div style="width: 400px; padding: 20px;">
          <div style="padding: 15px; background: rgba(100, 100, 100, 0.1); margin-bottom: 15px;">
            Content above divider
          </div>
          <story />
          <div style="padding: 15px; background: rgba(100, 100, 100, 0.1); margin-top: 15px;">
            Content below divider
          </div>
        </div>
      `
    })
  ]
}

export const VerticalLayout: Story = {
  args: {
    text: 'Vertical',
    position: 'left',
    align: 'center',
    type: 'solid',
    layout: 'vertical'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Text divider in vertical layout for side-by-side content separation.'
      }
    }
  },
  decorators: [
    () => ({
      template: `
        <div style="height: 200px; display: flex; align-items: stretch; padding: 20px;">
          <div style="padding: 15px; background: rgba(100, 100, 100, 0.1); margin-right: 15px; flex: 1;">
            Left Content
          </div>
          <story />
          <div style="padding: 15px; background: rgba(100, 100, 100, 0.1); margin-left: 15px; flex: 1;">
            Right Content
          </div>
        </div>
      `
    })
  ]
}

export const LongText: Story = {
  args: {
    text: 'Configuration Settings and Options',
    position: 'left',
    align: 'center',
    type: 'solid',
    layout: 'horizontal'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Text divider with longer text content to demonstrate text wrapping and spacing behavior.'
      }
    }
  },
  decorators: [
    () => ({
      template: `
        <div style="width: 300px; padding: 20px;">
          <div style="padding: 15px; background: rgba(100, 100, 100, 0.1); margin-bottom: 15px;">
            Content above divider
          </div>
          <story />
          <div style="padding: 15px; background: rgba(100, 100, 100, 0.1); margin-top: 15px;">
            Content below divider
          </div>
        </div>
      `
    })
  ]
}
