import type { Meta, StoryObj } from '@storybook/vue3-vite'

import UserAvatar from './UserAvatar.vue'

const meta: Meta<typeof UserAvatar> = {
  title: 'Components/Common/UserAvatar',
  component: UserAvatar,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'UserAvatar displays a circular avatar image with fallback to a user icon when no image is provided or when the image fails to load. Built on top of PrimeVue Avatar component.'
      }
    }
  },
  argTypes: {
    photoUrl: {
      control: 'text',
      description:
        'URL of the user photo to display. Falls back to user icon if null, undefined, or fails to load',
      defaultValue: null
    },
    ariaLabel: {
      control: 'text',
      description: 'Accessibility label for screen readers',
      defaultValue: undefined
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof UserAvatar>

export const Default: Story = {
  args: {
    photoUrl: null,
    ariaLabel: 'User avatar'
  },
  parameters: {
    docs: {
      description: {
        story: 'Default avatar with no image - shows user icon fallback.'
      }
    }
  }
}

export const WithValidImage: Story = {
  args: {
    photoUrl:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    ariaLabel: 'John Doe avatar'
  },
  parameters: {
    docs: {
      description: {
        story: 'Avatar with a valid image URL displaying a user photo.'
      }
    }
  }
}

export const WithBrokenImage: Story = {
  args: {
    photoUrl: 'https://example.com/nonexistent-image.jpg',
    ariaLabel: 'User with broken image'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Avatar with a broken image URL - automatically falls back to user icon when image fails to load.'
      }
    }
  }
}

export const WithCustomAriaLabel: Story = {
  args: {
    photoUrl:
      'https://images.unsplash.com/photo-1494790108755-2616b612b586?w=100&h=100&fit=crop&crop=face',
    ariaLabel: 'Sarah Johnson, Project Manager'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Avatar with custom accessibility label for better screen reader experience.'
      }
    }
  }
}

export const EmptyString: Story = {
  args: {
    photoUrl: '',
    ariaLabel: 'User with empty photo URL'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Avatar with empty string photo URL - treats empty string as no image.'
      }
    }
  }
}

export const UndefinedUrl: Story = {
  args: {
    photoUrl: undefined,
    ariaLabel: 'User with undefined photo URL'
  },
  parameters: {
    docs: {
      description: {
        story: 'Avatar with undefined photo URL - shows default user icon.'
      }
    }
  }
}

// Gallery view showing different states
export const Gallery: Story = {
  render: () => ({
    components: { UserAvatar },
    template: `
      <div style="display: flex; gap: 20px; flex-wrap: wrap; align-items: center; padding: 20px;">
        <div style="text-align: center;">
          <UserAvatar :photoUrl="null" ariaLabel="No image" />
          <div style="margin-top: 8px; font-size: 12px; color: #666;">No Image</div>
        </div>
        <div style="text-align: center;">
          <UserAvatar photoUrl="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" ariaLabel="Valid image" />
          <div style="margin-top: 8px; font-size: 12px; color: #666;">Valid Image</div>
        </div>
        <div style="text-align: center;">
          <UserAvatar photoUrl="https://images.unsplash.com/photo-1494790108755-2616b612b586?w=100&h=100&fit=crop&crop=face" ariaLabel="Another valid image" />
          <div style="margin-top: 8px; font-size: 12px; color: #666;">Another Valid</div>
        </div>
        <div style="text-align: center;">
          <UserAvatar photoUrl="https://example.com/broken.jpg" ariaLabel="Broken image" />
          <div style="margin-top: 8px; font-size: 12px; color: #666;">Broken URL</div>
        </div>
        <div style="text-align: center;">
          <UserAvatar photoUrl="" ariaLabel="Empty string" />
          <div style="margin-top: 8px; font-size: 12px; color: #666;">Empty String</div>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Gallery showing different avatar states side by side for comparison.'
      }
    }
  }
}
