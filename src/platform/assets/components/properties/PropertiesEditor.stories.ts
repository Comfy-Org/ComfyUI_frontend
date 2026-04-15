import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref } from 'vue'

import type {
  PropertySuggestion,
  UserProperties
} from '@/platform/assets/schemas/userPropertySchema'

import PropertiesEditor from './PropertiesEditor.vue'

const meta: Meta<typeof PropertiesEditor> = {
  title: 'Platform/Assets/PropertiesEditor',
  component: PropertiesEditor,
  parameters: {
    layout: 'centered'
  },
  decorators: [
    () => ({
      template: `
        <div class="bg-base-background p-6">
          <story />
        </div>
      `
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

const sampleProperties: UserProperties = {
  caption: { type: 'string', value: 'Golden hour at the Pacific' },
  favorite: { type: 'boolean', value: true },
  rating: { type: 'number', value: 4, min: 1, max: 5 }
}

const sampleSuggestions = new Map<string, PropertySuggestion>([
  ['caption', { type: 'string' }],
  ['favorite', { type: 'boolean' }],
  ['rating', { type: 'number', min: 1, max: 5 }],
  ['quality', { type: 'number', min: 0, max: 10 }],
  ['nsfw', { type: 'boolean' }],
  ['source', { type: 'string' }],
  ['artist', { type: 'string' }]
])

export const Default: Story = {
  render: () => ({
    components: { PropertiesEditor },
    setup() {
      const properties = ref<UserProperties>({})
      return { properties }
    },
    template: `
      <div class="w-[320px] rounded-lg border border-panel-border">
        <PropertiesEditor v-model="properties" />
        <pre class="mt-2 border-t border-panel-border p-3 text-xs text-muted-foreground">{{ JSON.stringify(properties, null, 2) }}</pre>
      </div>
    `
  })
}

export const WithData: Story = {
  render: () => ({
    components: { PropertiesEditor },
    setup() {
      const properties = ref<UserProperties>({ ...sampleProperties })
      return { properties }
    },
    template: `
      <div class="w-[320px] rounded-lg border border-panel-border">
        <PropertiesEditor v-model="properties" />
        <pre class="mt-2 border-t border-panel-border p-3 text-xs text-muted-foreground">{{ JSON.stringify(properties, null, 2) }}</pre>
      </div>
    `
  })
}

export const Interactive: Story = {
  render: () => ({
    components: { PropertiesEditor },
    setup() {
      const properties = ref<UserProperties>({ ...sampleProperties })
      return { properties, suggestions: sampleSuggestions }
    },
    template: `
      <div class="w-[320px] rounded-lg border border-panel-border">
        <PropertiesEditor v-model="properties" :suggestions="suggestions" />
        <pre class="mt-2 border-t border-panel-border p-3 text-xs text-muted-foreground">State: {{ JSON.stringify(properties, null, 2) }}</pre>
      </div>
    `
  })
}

export const WithSuggestions: Story = {
  render: () => ({
    components: { PropertiesEditor },
    setup() {
      const properties = ref<UserProperties>({})
      return { properties, suggestions: sampleSuggestions }
    },
    template: `
      <div class="w-[320px] rounded-lg border border-panel-border">
        <PropertiesEditor v-model="properties" :suggestions="suggestions" />
        <pre class="mt-2 border-t border-panel-border p-3 text-xs text-muted-foreground">State: {{ JSON.stringify(properties, null, 2) }}</pre>
      </div>
    `
  })
}

export const ReadOnly: Story = {
  render: () => ({
    components: { PropertiesEditor },
    setup() {
      const properties = ref<UserProperties>({ ...sampleProperties })
      return { properties }
    },
    template: `
      <div class="w-[320px] rounded-lg border border-panel-border">
        <PropertiesEditor v-model="properties" :readonly="true" />
      </div>
    `
  })
}

export const BatchEdit: Story = {
  render: () => ({
    components: { PropertiesEditor },
    setup() {
      const properties = ref<UserProperties>({
        caption: { type: 'string', value: '' },
        favorite: { type: 'boolean', value: true },
        rating: { type: 'number', value: 4, min: 1, max: 5 },
        quality: { type: 'number', value: 7, min: 0, max: 10 }
      })
      const propertyCounts = new Map([
        ['caption', 3],
        ['favorite', 5],
        ['rating', 5],
        ['quality', 2]
      ])
      const mixedKeys = new Set(['caption', 'quality'])
      return {
        properties,
        propertyCounts,
        mixedKeys,
        suggestions: sampleSuggestions
      }
    },
    template: `
      <div class="w-[320px] rounded-lg border border-panel-border">
        <PropertiesEditor
          v-model="properties"
          :suggestions="suggestions"
          :total-count="5"
          :property-counts="propertyCounts"
          :mixed-keys="mixedKeys"
        />
        <pre class="mt-2 border-t border-panel-border p-3 text-xs text-muted-foreground">State: {{ JSON.stringify(properties, null, 2) }}</pre>
      </div>
    `
  })
}

export const DynamicSuggestions: Story = {
  render: () => ({
    components: { PropertiesEditor },
    setup() {
      const propsA = ref<UserProperties>({
        caption: { type: 'string', value: 'Sunset photo' },
        rating: { type: 'number', value: 5, min: 1, max: 5 }
      })
      const propsB = ref<UserProperties>({})

      // Live suggestions derived from both assets — same as usePropertySuggestions
      const liveSuggestions = computed(() => {
        const map = new Map<string, PropertySuggestion>()
        for (const props of [propsA.value, propsB.value]) {
          for (const [key, prop] of Object.entries(props)) {
            if (map.has(key)) continue
            const s: PropertySuggestion = { type: prop.type }
            if (prop.type === 'number') {
              if (prop.min !== undefined) s.min = prop.min
              if (prop.max !== undefined) s.max = prop.max
            }
            map.set(key, s)
          }
        }
        return map
      })

      return { propsA, propsB, liveSuggestions }
    },
    template: `
      <div class="flex gap-4">
        <div class="w-[320px] rounded-lg border border-panel-border">
          <div class="border-b border-panel-border px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Asset A</div>
          <PropertiesEditor v-model="propsA" :suggestions="liveSuggestions" />
        </div>
        <div class="w-[320px] rounded-lg border border-panel-border">
          <div class="border-b border-panel-border px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Asset B</div>
          <PropertiesEditor v-model="propsB" :suggestions="liveSuggestions" />
        </div>
      </div>
    `
  })
}
