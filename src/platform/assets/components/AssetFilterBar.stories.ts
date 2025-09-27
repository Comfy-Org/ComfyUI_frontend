import type { Meta, StoryObj } from '@storybook/vue3-vite'

import {
  createAssetWithSpecificBaseModel,
  createAssetWithSpecificExtension,
  createAssetWithoutBaseModel,
  createAssetWithoutExtension
} from '@/platform/assets/fixtures/ui-mock-assets'

import AssetFilterBar from './AssetFilterBar.vue'

const meta: Meta<typeof AssetFilterBar> = {
  title: 'Platform/Assets/AssetFilterBar',
  component: AssetFilterBar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Filter bar for asset browser that dynamically shows/hides filters based on available options.'
      }
    }
  },
  decorators: [
    () => ({
      template: `
        <div class="min-h-screen bg-white dark-theme:bg-charcoal-900">
          <div class="bg-gray-50 dark-theme:bg-charcoal-800 border-b border-gray-200 dark-theme:border-charcoal-600">
            <story />
          </div>
          <div class="p-6 text-sm text-gray-600 dark-theme:text-gray-400">
            <p>Filter bar with proper chrome styling showing contextual background and borders.</p>
          </div>
        </div>
      `
    })
  ],
  argTypes: {
    assets: {
      description: 'Array of assets to generate filter options from'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const BothFiltersVisible: Story = {
  args: {
    assets: [
      createAssetWithSpecificExtension('safetensors'),
      createAssetWithSpecificExtension('ckpt'),
      createAssetWithSpecificBaseModel('sd15'),
      createAssetWithSpecificBaseModel('sdxl')
    ]
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows both file format and base model filters when assets contain both types of options.'
      }
    }
  }
}

export const OnlyFileFormatFilter: Story = {
  args: {
    assets: [
      // Assets with extensions but explicitly NO base models
      {
        ...createAssetWithSpecificExtension('safetensors'),
        user_metadata: undefined
      },
      { ...createAssetWithSpecificExtension('ckpt'), user_metadata: undefined }
    ]
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows only file format filter when assets have file extensions but no base model metadata.'
      }
    }
  }
}

export const OnlyBaseModelFilter: Story = {
  args: {
    assets: [
      // Assets with base models but no recognizable extensions
      {
        ...createAssetWithSpecificBaseModel('sd15'),
        name: 'model_without_extension'
      },
      { ...createAssetWithSpecificBaseModel('sdxl'), name: 'another_model' }
    ]
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows only base model filter when assets have base model metadata but no recognizable file extensions.'
      }
    }
  }
}

export const NoFiltersVisible: Story = {
  args: {
    assets: []
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows no filters when no assets are provided or assets contain no filterable options.'
      }
    }
  }
}

export const NoFiltersFromAssetsWithoutOptions: Story = {
  args: {
    assets: [createAssetWithoutExtension(), createAssetWithoutBaseModel()]
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows no filters when assets are provided but contain no filterable options (no extensions or base models).'
      }
    }
  }
}
