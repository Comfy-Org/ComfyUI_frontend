<script setup lang="ts">
import { provide, reactive } from 'vue'

import type {
  SimplifiedControlWidget,
  SimplifiedWidget
} from '../src/types/simplifiedWidget'
import { isControlOption } from '../src/types/simplifiedWidget'
import { UnifiedWidgetRowsKey } from '../src/types/widgetRowLayout'

import WidgetInputNumberInput from '../src/renderer/extensions/vueNodes/widgets/components/WidgetInputNumberInput.vue'
import WidgetInputText from '../src/renderer/extensions/vueNodes/widgets/components/WidgetInputText.vue'
import WidgetSelectDefault from '../src/renderer/extensions/vueNodes/widgets/components/WidgetSelectDefault.vue'
import WidgetTextarea from '../src/renderer/extensions/vueNodes/widgets/components/WidgetTextarea.vue'
import WidgetWithControl from '../src/renderer/extensions/vueNodes/widgets/components/WidgetWithControl.vue'

const {
  unified = true,
  heading,
  seedValue = 9007199254740990
} = defineProps<{
  unified?: boolean
  heading: string
  seedValue?: number
}>()
provide(UnifiedWidgetRowsKey, unified)

const values = reactive({
  steps: 8,
  seed: seedValue,
  seedMode: 'fixed',
  sampler: 'res_multistep',
  model:
    'Comfy-Org/z_image_turbo/diffusion_models/z_image_turbo_bf16.safetensors',
  filename: 'ComfyUI/night_campfire',
  prompt:
    'Anime RPG game style, a girl with gigantic fennec ears and a fluffy fox tail, playing guitar beside a campfire beneath a milky way galaxy sky.',
  negative: ''
})

const steps: SimplifiedWidget<number> = {
  name: 'steps',
  type: 'INT',
  value: 8,
  options: { min: 1, max: 100, step2: 1, precision: 0 }
}
const seed: SimplifiedControlWidget<number> = {
  name: 'seed',
  type: 'INT',
  value: seedValue,
  label: 'Noise seed',
  options: { min: 0, max: Number.MAX_SAFE_INTEGER, step2: 1, precision: 0 },
  controlWidget: {
    value: 'fixed',
    update: (value) => {
      if (isControlOption(value)) values.seedMode = value
    }
  }
}
const sampler: SimplifiedWidget<string | undefined> = {
  name: 'sampler_name',
  type: 'COMBO',
  value: values.sampler,
  label: 'Sampling algorithm',
  options: { values: ['res_multistep', 'euler', 'dpmpp_2m'] }
}
const model: SimplifiedWidget<string | undefined> = {
  name: 'unet_name',
  type: 'COMBO',
  value: values.model,
  label: 'Diffusion model',
  options: {
    values: [
      values.model,
      'Studio/archive/diffusion_models/z_image_turbo_bf16.safetensors',
      'Comfy-Org/flux/flux_dev.safetensors',
      'C:\\models\\checkpoints\\portrait.safetensors',
      'local/ae.safetensors'
    ]
  }
}
const filename: SimplifiedWidget<string> = {
  name: 'filename_prefix',
  label: 'Filename prefix',
  type: 'STRING',
  value: values.filename
}
const prompt: SimplifiedWidget<string> = {
  name: 'positive_prompt',
  label: 'Positive prompt',
  type: 'STRING',
  value: values.prompt
}
const negative: SimplifiedWidget<string> = {
  name: 'negative_prompt',
  label: 'Negative prompt',
  type: 'STRING',
  value: ''
}
</script>

<template>
  <section
    class="rounded-xl bg-node p-3 text-xs text-node-foreground shadow-lg"
  >
    <div
      class="mb-4 flex items-center justify-between border-b border-border pb-3"
    >
      <span>{{ heading }}</span>
      <i class="icon-[lucide--sliders-horizontal] text-muted-foreground" />
    </div>
    <div
      :class="
        unified
          ? 'flex min-w-0 flex-col gap-2'
          : 'grid grid-cols-[min-content_minmax(80px,min-content)_minmax(125px,1fr)] gap-y-2'
      "
    >
      <div v-if="!unified" class="col-span-1 col-start-1 row-span-5 w-3" />
      <WidgetInputNumberInput
        v-model="values.steps"
        :widget="steps"
        class="col-span-2"
      />
      <WidgetWithControl
        v-model="values.seed"
        :widget="seed"
        :component="WidgetInputNumberInput"
        class="col-span-2"
      />
      <WidgetSelectDefault
        v-model="values.sampler"
        :widget="sampler"
        class="col-span-2"
      />
      <WidgetSelectDefault
        v-model="values.model"
        :widget="model"
        :filename-summary="unified"
        class="col-span-2"
      />
      <WidgetInputText
        v-model="values.filename"
        :widget="filename"
        class="col-span-2"
      />
    </div>
    <div class="mt-3 grid gap-3">
      <WidgetTextarea v-model="values.prompt" :widget="prompt" class="h-36" />
      <WidgetTextarea
        v-model="values.negative"
        :widget="negative"
        class="h-28"
      />
    </div>
    <output hidden data-testid="prototype-raw-values">{{
      JSON.stringify(values)
    }}</output>
  </section>
</template>
