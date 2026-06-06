import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { mockAssets } from '@/platform/assets/fixtures/ui-mock-assets'

import AssetCard from './AssetCard.vue'
import AssetRating from './AssetRating.vue'

const baseAsset = mockAssets[0]
const GENERATED_OUTPUT_PREVIEW = '/assets/images/default-template.png'

function createAssetCardData(
  overrides: Partial<AssetDisplayItem> = {}
): AssetDisplayItem {
  return {
    ...baseAsset,
    name: 'workflow-output.png',
    preview_url: GENERATED_OUTPUT_PREVIEW,
    secondaryText:
      'High-quality realistic images with perfect detail and natural lighting effects for professional photography',
    badges: [
      { label: 'checkpoints', type: 'type' },
      { label: '2.1 GB', type: 'size' }
    ],
    stats: {
      downloadCount: '1.8k',
      stars: '4.2k'
    },
    ...overrides
  }
}

const meta: Meta<typeof AssetRating> = {
  title: 'Platform/Assets/AssetRating',
  component: AssetRating,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'AssetRating is a persistence-agnostic control for rating individual generated output assets. It uses a clearable 1-5 scale so unrated remains distinct from low quality, supports quick keyboard triage, and leaves project-shared storage, notes, tags, and workflow-level aggregation to the asset integration layer.'
      }
    }
  },
  decorators: [
    () => ({
      template: '<div class="bg-base-background p-8"><story /></div>'
    })
  ],
  argTypes: {
    modelValue: {
      control: { type: 'number', min: 1, max: 5 }
    },
    max: {
      control: { type: 'number', min: 1, max: 10 }
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg']
    },
    variant: {
      control: 'select',
      options: ['stars', 'paintbrushes', 'comfy']
    }
  },
  args: {
    modelValue: null,
    max: 5,
    size: 'sm',
    variant: 'stars',
    disabled: false,
    readOnly: false
  }
}

export default meta
type Story = StoryObj<typeof meta>

function renderInteractive(args: Story['args']) {
  return {
    components: { AssetRating },
    setup() {
      const rating = ref<number | null>(args?.modelValue ?? null)

      return {
        args,
        rating
      }
    },
    template: `
      <div class="flex flex-col gap-3">
        <AssetRating
          v-model="rating"
          :aria-label="args?.ariaLabel"
          :disabled="args?.disabled"
          :max="args?.max"
          :read-only="args?.readOnly"
          :size="args?.size"
          :variant="args?.variant"
        />
        <p class="m-0 text-xs text-muted-foreground">
          Selected: {{ rating ?? 'Unrated' }}
        </p>
      </div>
    `
  }
}

export const Unrated: Story = {
  args: {
    modelValue: null
  }
}

export const Rated: Story = {
  args: {
    modelValue: 4
  }
}

export const Interactive: Story = {
  render: renderInteractive,
  args: {
    modelValue: 2
  }
}

export const Clearable: Story = {
  render: renderInteractive,
  args: {
    modelValue: 3
  },
  parameters: {
    docs: {
      description: {
        story: 'Click the selected rating again to return the asset to unrated.'
      }
    }
  }
}

export const ReadOnly: Story = {
  args: {
    modelValue: 4,
    readOnly: true
  }
}

export const Disabled: Story = {
  args: {
    modelValue: 3,
    disabled: true
  }
}

export const Sizes: Story = {
  render: () => ({
    components: { AssetRating },
    template: `
      <div class="flex flex-col gap-4">
        <AssetRating :model-value="3" size="sm" />
        <AssetRating :model-value="3" size="md" />
        <AssetRating :model-value="3" size="lg" />
      </div>
    `
  })
}

export const Variants: Story = {
  render: () => ({
    components: { AssetRating },
    template: `
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">Stars</span>
          <AssetRating :model-value="4" size="md" variant="stars" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">Paintbrushes</span>
          <AssetRating :model-value="4" size="md" variant="paintbrushes" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">Comfy C</span>
          <AssetRating :model-value="4" size="md" variant="comfy" />
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Stars are the familiar default rating glyph. Paintbrushes and the Comfy C mark explore more distinctive creative-tool cues without changing the rating behavior.'
      }
    }
  }
}

export const AllStates: Story = {
  render: () => ({
    components: { AssetRating },
    template: `
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">Unrated</span>
          <AssetRating :model-value="null" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">Rated</span>
          <AssetRating :model-value="5" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">Read-only</span>
          <AssetRating :model-value="4" read-only />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">Disabled</span>
          <AssetRating :model-value="2" disabled />
        </div>
      </div>
    `
  })
}

export const AssetCardContext: Story = {
  render: () => ({
    components: { AssetCard, AssetRating },
    setup() {
      const rating = ref<number | null>(null)
      const asset = createAssetCardData()

      return {
        asset,
        rating
      }
    },
    template: `
      <div class="relative w-72">
        <AssetCard :asset="asset" interactive />
        <div class="absolute top-4 left-4 rounded-md bg-base-background/90 p-1 shadow-interface">
          <AssetRating v-model="rating" size="sm" />
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Storybook-only composition showing how rating could sit over the preview area of the existing AssetCard without competing with bottom metadata or changing production card APIs.'
      }
    }
  }
}

export const AssetCardComfyVariant: Story = {
  render: () => ({
    components: { AssetCard, AssetRating },
    setup() {
      const rating = ref<number | null>(4)
      const asset = createAssetCardData({
        id: 'comfy-variant-output',
        name: 'workflow-output-comfy.png'
      })

      return {
        asset,
        rating
      }
    },
    template: `
      <div class="relative w-72">
        <AssetCard :asset="asset" interactive />
        <div class="absolute top-4 left-4 rounded-md bg-base-background/90 p-1 shadow-interface">
          <AssetRating v-model="rating" size="sm" variant="comfy" />
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Storybook-only card context using the Comfy C mark as an exploratory rating glyph while preserving the same rating behavior.'
      }
    }
  }
}

export const FirstRunDiscoverability: Story = {
  render: () => ({
    components: { AssetCard, AssetRating },
    setup() {
      const firstRating = ref<number | null>(null)
      const savedRating = ref<number | null>(4)
      const firstAsset = createAssetCardData({
        id: 'first-run-output',
        name: 'first-run.png'
      })
      const savedAsset = createAssetCardData({
        id: 'reviewed-output',
        name: 'reviewed.png'
      })

      return {
        firstAsset,
        firstRating,
        savedAsset,
        savedRating
      }
    },
    template: `
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="group/card relative w-72">
          <AssetCard :asset="firstAsset" interactive />
          <div class="absolute top-4 left-4 rounded-md bg-base-background/90 p-1 opacity-0 shadow-interface transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
            <AssetRating v-model="firstRating" size="sm" />
          </div>
        </div>

        <div class="relative w-72">
          <AssetCard :asset="savedAsset" interactive />
          <div class="absolute top-4 left-4 rounded-md bg-base-background/90 p-1 shadow-interface">
            <AssetRating v-model="savedRating" size="sm" />
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Storybook-only exploration of the intended asset-card behavior: keep unrated cards visually quiet, reveal the control on hover/focus, and keep rated assets visible for scanning.'
      }
    }
  }
}

interface BatchAsset {
  asset: AssetDisplayItem
  rating: number | null
}

export const BatchTriage: Story = {
  render: () => ({
    components: { AssetCard, AssetRating },
    setup() {
      const assets = ref<BatchAsset[]>([
        {
          asset: createAssetCardData({
            id: 'asset-1',
            name: 'output-001.png',
            secondaryText: 'Seed 314159'
          }),
          rating: 5
        },
        {
          asset: createAssetCardData({
            id: 'asset-2',
            name: 'output-002.png',
            secondaryText: 'Seed 314160'
          }),
          rating: 3
        },
        {
          asset: createAssetCardData({
            id: 'asset-3',
            name: 'output-003.png',
            secondaryText: 'Seed 314161'
          }),
          rating: null
        },
        {
          asset: createAssetCardData({
            id: 'asset-4',
            name: 'output-004.png',
            secondaryText: 'Seed 314162'
          }),
          rating: null
        }
      ])

      return { assets }
    },
    template: `
      <div class="flex max-w-5xl flex-col gap-3">
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div
            v-for="item in assets"
            :key="item.asset.id"
            class="relative w-64"
          >
            <AssetCard :asset="item.asset" interactive />
            <div class="absolute top-4 left-4 rounded-md bg-base-background/90 p-1 shadow-interface">
              <AssetRating v-model="item.rating" size="sm" />
            </div>
          </div>
        </div>
        <p class="m-0 text-xs text-muted-foreground">
          Tab through assets and use arrow keys or number keys to triage a batch.
        </p>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Storybook-only batch example showing independent per-asset ratings for outputs from the same workflow run.'
      }
    }
  }
}
