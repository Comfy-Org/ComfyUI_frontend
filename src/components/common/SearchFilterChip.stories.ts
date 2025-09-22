import type { Meta, StoryObj } from '@storybook/vue3-vite'

import SearchFilterChip from './SearchFilterChip.vue'

const meta: Meta<typeof SearchFilterChip> = {
  title: 'Components/Common/SearchFilterChip',
  component: SearchFilterChip,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'SearchFilterChip displays a removable chip with a badge and text, commonly used for showing active filters in search interfaces. Built with PrimeVue Chip and Badge components.'
      }
    }
  },
  argTypes: {
    text: {
      control: 'text',
      description: 'Main text content displayed on the chip',
      defaultValue: 'Filter'
    },
    badge: {
      control: 'text',
      description: 'Badge text/number displayed before the main text',
      defaultValue: '1'
    },
    badgeClass: {
      control: 'select',
      options: ['i-badge', 'o-badge', 'c-badge', 's-badge'],
      description:
        'CSS class for badge styling (i-badge: green, o-badge: red, c-badge: blue, s-badge: yellow)',
      defaultValue: 'i-badge'
    },
    onRemove: {
      description: 'Event emitted when the chip remove button is clicked'
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof SearchFilterChip>

export const Default: Story = {
  args: {
    text: 'Active Filter',
    badge: '5',
    badgeClass: 'i-badge'
  },
  parameters: {
    docs: {
      description: {
        story: 'Default search filter chip with green badge.'
      }
    }
  }
}

export const InputBadge: Story = {
  args: {
    text: 'Inputs',
    badge: '3',
    badgeClass: 'i-badge'
  },
  parameters: {
    docs: {
      description: {
        story: 'Filter chip with green input badge (i-badge class).'
      }
    }
  }
}

export const OutputBadge: Story = {
  args: {
    text: 'Outputs',
    badge: '2',
    badgeClass: 'o-badge'
  },
  parameters: {
    docs: {
      description: {
        story: 'Filter chip with red output badge (o-badge class).'
      }
    }
  }
}

export const CategoryBadge: Story = {
  args: {
    text: 'Category',
    badge: '8',
    badgeClass: 'c-badge'
  },
  parameters: {
    docs: {
      description: {
        story: 'Filter chip with blue category badge (c-badge class).'
      }
    }
  }
}

export const StatusBadge: Story = {
  args: {
    text: 'Status',
    badge: '12',
    badgeClass: 's-badge'
  },
  parameters: {
    docs: {
      description: {
        story: 'Filter chip with yellow status badge (s-badge class).'
      }
    }
  }
}

export const LongText: Story = {
  args: {
    text: 'Very Long Filter Name That Might Wrap',
    badge: '999+',
    badgeClass: 'i-badge'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Filter chip with long text and large badge number to test layout.'
      }
    }
  }
}

export const SingleCharacterBadge: Story = {
  args: {
    text: 'Model Type',
    badge: 'A',
    badgeClass: 'c-badge'
  },
  parameters: {
    docs: {
      description: {
        story: 'Filter chip with single character badge.'
      }
    }
  }
}

export const ComfyUIFilters: Story = {
  render: () => ({
    components: { SearchFilterChip },
    methods: {
      handleRemove: () => console.log('Filter removed')
    },
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; padding: 20px;">
        <SearchFilterChip
          text="Sampling Nodes"
          badge="5"
          badgeClass="i-badge"
          @remove="handleRemove"
        />
        <SearchFilterChip
          text="Image Outputs"
          badge="3"
          badgeClass="o-badge"
          @remove="handleRemove"
        />
        <SearchFilterChip
          text="Conditioning"
          badge="12"
          badgeClass="c-badge"
          @remove="handleRemove"
        />
        <SearchFilterChip
          text="Advanced"
          badge="7"
          badgeClass="s-badge"
          @remove="handleRemove"
        />
        <SearchFilterChip
          text="SDXL Models"
          badge="24"
          badgeClass="i-badge"
          @remove="handleRemove"
        />
        <SearchFilterChip
          text="ControlNet"
          badge="8"
          badgeClass="o-badge"
          @remove="handleRemove"
        />
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Example showing multiple filter chips as they might appear in ComfyUI search interface.'
      }
    }
  }
}

export const Interactive: Story = {
  args: {
    text: 'Removable Filter',
    badge: '42',
    badgeClass: 'i-badge'
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive chip - click the X button to see the remove event in the Actions panel.'
      }
    }
  }
}

// Gallery showing all badge styles
export const BadgeStyleGallery: Story = {
  render: () => ({
    components: { SearchFilterChip },
    methods: {
      handleRemove: () => console.log('Filter removed')
    },
    template: `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 20px; max-width: 400px;">
        <div style="text-align: center;">
          <SearchFilterChip
            text="Input Badge"
            badge="I"
            badgeClass="i-badge"
            @remove="handleRemove"
          />
          <div style="margin-top: 8px; font-size: 12px; color: #666;">Green (i-badge)</div>
        </div>
        <div style="text-align: center;">
          <SearchFilterChip
            text="Output Badge"
            badge="O"
            badgeClass="o-badge"
            @remove="handleRemove"
          />
          <div style="margin-top: 8px; font-size: 12px; color: #666;">Red (o-badge)</div>
        </div>
        <div style="text-align: center;">
          <SearchFilterChip
            text="Category Badge"
            badge="C"
            badgeClass="c-badge"
            @remove="handleRemove"
          />
          <div style="margin-top: 8px; font-size: 12px; color: #666;">Blue (c-badge)</div>
        </div>
        <div style="text-align: center;">
          <SearchFilterChip
            text="Status Badge"
            badge="S"
            badgeClass="s-badge"
            @remove="handleRemove"
          />
          <div style="margin-top: 8px; font-size: 12px; color: #666;">Yellow (s-badge)</div>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story: 'Gallery showing all available badge styles and their colors.'
      }
    }
  }
}
