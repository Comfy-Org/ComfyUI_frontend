import { Brush, ImagePlus, Lamp, RotateCcw, Sun, Type } from '@lucide/vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import EditorAlert from './EditorAlert.vue'
import EditorChip from './EditorChip.vue'
import EditorCollapsible from './EditorCollapsible.vue'
import EditorHint from './EditorHint.vue'
import EditorIconButton from './EditorIconButton.vue'
import EditorMenuButton from './EditorMenuButton.vue'
import EditorNumberField from './EditorNumberField.vue'
import EditorOutput from './EditorOutput.vue'
import EditorPanelRow from './EditorPanelRow.vue'
import EditorSeedField from './EditorSeedField.vue'
import EditorSegmented from './EditorSegmented.vue'
import EditorSelect from './EditorSelect.vue'
import EditorSwitch from './EditorSwitch.vue'

/**
 * The fields an app puts in its floating side panel and its bottom composer.
 * Every field is a `v-model` over app state and takes its copy as props, so an
 * app owns its words and the kit owns the look.
 */
const meta: Meta = {
  title: 'Website/Workshop/AppEditor/Fields',
  tags: ['autodocs'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

const LIGHTS = [
  { id: 'golden', label: 'Golden' },
  { id: 'night', label: 'Night' },
  { id: 'overcast', label: 'Overcast' }
] as const

const MODELS = [
  { id: 'flux', label: 'FLUX.2 Pro' },
  { id: 'seedream', label: 'Seedream 4' },
  { id: 'nano', label: 'Nano Banana (soon)', disabled: true }
] as const

const SIZES = [
  { id: 'source', label: 'Same as source', detail: '1280 × 720' },
  { id: 'square', label: 'Square', detail: '1024 × 1024' },
  { id: 'wide', label: 'Widescreen', detail: '1920 × 1080' }
] as const

const ADD_ITEMS = [
  { id: 'image', label: 'Reference image', icon: ImagePlus },
  { id: 'text', label: 'Text layer', icon: Type },
  { id: 'mask', label: 'Mask', icon: Brush, disabled: true }
] as const

function fieldState() {
  return {
    light: ref<(typeof LIGHTS)[number]['id']>('golden'),
    model: ref<(typeof MODELS)[number]['id']>('flux'),
    size: ref<(typeof SIZES)[number]['id']>('source'),
    keepFace: ref(true),
    steps: ref(28),
    seed: ref(421_337)
  }
}

const components = {
  EditorAlert,
  EditorChip,
  EditorCollapsible,
  EditorHint,
  EditorIconButton,
  EditorMenuButton,
  EditorNumberField,
  EditorOutput,
  EditorPanelRow,
  EditorSeedField,
  EditorSegmented,
  EditorSelect,
  EditorSwitch
}

/** The side panel's rows: collapsible sections of labelled fields. */
export const PanelFields: Story = {
  render: () => ({
    components,
    setup: () => ({
      ...fieldState(),
      LIGHTS,
      MODELS,
      SIZES,
      RotateCcw,
      Sun
    }),
    template: `
      <div class="w-editor-panel rounded-2xl border border-transparency-white-t8 bg-primary-comfy-ink-light/90 px-4">
        <EditorCollapsible title="Light" meta="3 looks" initially-open>
          <template #actions>
            <EditorIconButton :icon="RotateCcw" label="Reset light" />
          </template>
          <EditorSegmented v-model="light" label="Time of day" :options="LIGHTS" fill />
          <EditorSwitch v-model="keepFace" label="Keep the face" />
        </EditorCollapsible>
        <EditorCollapsible title="Model" initially-open>
          <EditorSelect v-model="model" label="Model" :options="MODELS" />
          <EditorOutput v-model="size" heading="Output size" label="Size" :options="SIZES" />
        </EditorCollapsible>
        <EditorCollapsible title="Advanced">
          <EditorNumberField v-model="steps" label="Steps" />
          <EditorSeedField v-model="seed" label="Seed" shuffle-label="Shuffle seed" />
        </EditorCollapsible>
        <EditorPanelRow>
          <EditorSegmented v-model="light" label="Light" :options="LIGHTS" />
        </EditorPanelRow>
      </div>
    `
  })
}

/** The bottom composer's pills, with the notices that sit above it. */
export const ComposerPills: Story = {
  render: () => ({
    components,
    setup: () => ({ ...fieldState(), MODELS, SIZES, ADD_ITEMS, Lamp }),
    template: `
      <div class="flex flex-col items-center gap-4">
        <EditorAlert>The model could not read that image. Try another one.</EditorAlert>
        <div class="flex flex-wrap items-center gap-2 rounded-2xl border border-transparency-white-t20 bg-primary-comfy-ink-light p-2">
          <EditorMenuButton label="Add" :items="ADD_ITEMS" />
          <EditorMenuButton label="Add" :items="ADD_ITEMS" icon-only />
          <EditorChip label="Light" value="Golden hour">
            <Lamp class="size-3.5" aria-hidden="true" />
          </EditorChip>
          <EditorChip label="Light" value="Golden hour" expanded />
          <EditorChip label="Light" value="Golden hour" disabled />
          <EditorOutput v-model="size" heading="Output size" :options="SIZES" composer />
          <div class="h-9 w-48 rounded-xl ring-1 ring-transparency-white-t8 ring-inset">
            <EditorSelect v-model="model" label="Model" :options="MODELS" bare compact class="h-full" />
          </div>
        </div>
        <div class="relative h-24 w-96 rounded-sm bg-transparency-white-t4">
          <EditorHint text="Drag on the image to place the light" />
        </div>
      </div>
    `
  })
}
