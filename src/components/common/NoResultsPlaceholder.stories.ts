import type { Meta, StoryObj } from '@storybook/vue3-vite'

import NoResultsPlaceholder from './NoResultsPlaceholder.vue'

const meta: Meta<typeof NoResultsPlaceholder> = {
  title: 'Components/Common/NoResultsPlaceholder',
  component: NoResultsPlaceholder,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'NoResultsPlaceholder displays an empty state with optional icon, title, message, and action button. Built with PrimeVue Card component and customizable styling.'
      }
    }
  },
  argTypes: {
    class: {
      control: 'text',
      description: 'Additional CSS classes to apply to the wrapper',
      defaultValue: undefined
    },
    icon: {
      control: 'text',
      description: 'PrimeIcons icon class to display',
      defaultValue: undefined
    },
    title: {
      control: 'text',
      description: 'Main heading text',
      defaultValue: 'No Results'
    },
    message: {
      control: 'text',
      description: 'Descriptive message text (supports multi-line with \\n)',
      defaultValue: 'No items found'
    },
    textClass: {
      control: 'text',
      description: 'Additional CSS classes for the message text',
      defaultValue: undefined
    },
    buttonLabel: {
      control: 'text',
      description: 'Label for action button (button hidden if not provided)',
      defaultValue: undefined
    },
    onAction: {
      action: 'action',
      description: 'Event emitted when action button is clicked'
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof NoResultsPlaceholder>

export const Default: Story = {
  args: {
    title: 'No Results',
    message: 'No items found'
  },
  parameters: {
    docs: {
      description: {
        story: 'Basic placeholder with just title and message.'
      }
    }
  }
}

export const WithIcon: Story = {
  args: {
    icon: 'pi pi-search',
    title: 'No Search Results',
    message: 'Try adjusting your search criteria or filters'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Placeholder with a search icon to indicate empty search results.'
      }
    }
  }
}

export const WithActionButton: Story = {
  args: {
    icon: 'pi pi-plus',
    title: 'No Items',
    message: 'Get started by creating your first item',
    buttonLabel: 'Create Item'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Placeholder with an action button to help users take the next step.'
      }
    }
  }
}

export const MultilineMessage: Story = {
  args: {
    icon: 'pi pi-exclamation-triangle',
    title: 'Connection Error',
    message:
      'Unable to load data from the server.\nPlease check your internet connection\nand try again.',
    buttonLabel: 'Retry'
  },
  parameters: {
    docs: {
      description: {
        story: 'Placeholder with multi-line message using newline characters.'
      }
    }
  }
}

export const EmptyWorkflow: Story = {
  args: {
    icon: 'pi pi-sitemap',
    title: 'No Workflows',
    message:
      'Create your first ComfyUI workflow to get started with image generation',
    buttonLabel: 'New Workflow'
  },
  parameters: {
    docs: {
      description: {
        story: 'Example for empty workflow state in ComfyUI context.'
      }
    }
  }
}

export const EmptyModels: Story = {
  args: {
    icon: 'pi pi-download',
    title: 'No Models Found',
    message:
      'Download models from the model manager to start generating images',
    buttonLabel: 'Open Model Manager'
  },
  parameters: {
    docs: {
      description: {
        story: 'Example for empty models state with download action.'
      }
    }
  }
}

export const FilteredResults: Story = {
  args: {
    icon: 'pi pi-filter',
    title: 'No Matching Results',
    message:
      'No items match your current filters.\nTry clearing some filters to see more results.',
    buttonLabel: 'Clear Filters'
  },
  parameters: {
    docs: {
      description: {
        story: 'Placeholder for filtered results with option to clear filters.'
      }
    }
  }
}

export const CustomStyling: Story = {
  args: {
    class: 'custom-placeholder',
    icon: 'pi pi-star',
    title: 'No Favorites',
    message: 'Mark items as favorites to see them here',
    textClass: 'text-muted-foreground',
    buttonLabel: 'Browse Items'
  },
  parameters: {
    docs: {
      description: {
        story: 'Placeholder with custom CSS classes applied.'
      }
    }
  }
}

// Interactive story to test action event
export const Interactive: Story = {
  args: {
    icon: 'pi pi-cog',
    title: 'Configuration Required',
    message: 'Complete the setup to continue',
    buttonLabel: 'Configure'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive placeholder - click the button to see the action event in the Actions panel.'
      }
    }
  }
}

// Gallery view showing different icon options
export const IconGallery: Story = {
  render: () => ({
    components: { NoResultsPlaceholder },
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; padding: 20px;">
        <NoResultsPlaceholder 
          icon="pi pi-search" 
          title="Search" 
          message="No search results" 
        />
        <NoResultsPlaceholder 
          icon="pi pi-inbox" 
          title="Empty Inbox" 
          message="No messages" 
        />
        <NoResultsPlaceholder 
          icon="pi pi-heart" 
          title="No Favorites" 
          message="No favorite items" 
        />
        <NoResultsPlaceholder 
          icon="pi pi-folder-open" 
          title="Empty Folder" 
          message="This folder is empty" 
        />
        <NoResultsPlaceholder 
          icon="pi pi-shopping-cart" 
          title="Empty Cart" 
          message="Your cart is empty" 
        />
        <NoResultsPlaceholder 
          icon="pi pi-users" 
          title="No Users" 
          message="No users found" 
        />
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story: 'Gallery showing different icon options and use cases.'
      }
    }
  }
}
