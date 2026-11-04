<script setup lang="ts">
import NumberField from '@comfyorg/design-system/number-field/NumberField'
import NumberFieldInput from '@comfyorg/design-system/number-field/NumberFieldInput'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import Textarea from '@comfyorg/design-system/textarea/Textarea'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  ExecutableNode,
  SettingSpec,
  SettingValue
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import { incomingEdges } from '@/renderer/extensions/superComfy/engine/graphTopology'
import {
  RUN_LIMIT,
  useSuperComfyGraphStore
} from '@/renderer/extensions/superComfy/stores/superComfyGraphStore'
import { modalityIcon } from '@/renderer/extensions/superComfy/superComfyModality'

import SettingField from './SettingField.vue'
import SettingsCard from './SettingsCard.vue'
import {
  inlinePorts,
  resultCredits,
  resultNotices,
  summaryValues
} from './nodeView'

const { node } = defineProps<{ node: ExecutableNode }>()

const { t } = useI18n()
const store = useSuperComfyGraphStore()

const settings = computed<readonly SettingSpec[]>(
  () => node.contract?.settings ?? []
)

const inline = computed(() =>
  inlinePorts(
    node,
    (nodeId, port) => incomingEdges(store.state.doc, nodeId, port).length > 0
  )
)

const resolving = computed(
  () => node.kind === 'generate' && node.modelId !== null && !node.contract
)

const title = computed(() =>
  node.kind === 'generate'
    ? (node.modelLabel ?? t('superComfy.model.pick'))
    : node.title
)

const icon = computed(() =>
  node.kind === 'generate'
    ? modalityIcon(node.modality)
    : 'icon-[lucide--panels-top-left]'
)

const summary = computed(() =>
  [
    ...summaryValues(settings.value, node.values),
    ...(node.runCount > 1 ? [`×${node.runCount}`] : [])
  ].join(' · ')
)

const credits = computed(() => {
  const total = resultCredits(node)
  return total === null
    ? undefined
    : t('superComfy.node.credits', { credits: total })
})

const notices = computed(() => resultNotices(node))

function settingValue(spec: SettingSpec): SettingValue | undefined {
  return Object.hasOwn(node.values, spec.name)
    ? node.values[spec.name]
    : spec.default
}

function setValue(spec: SettingSpec, value: SettingValue | undefined) {
  store.dispatch({
    type: 'valueChanged',
    nodeId: node.id,
    name: spec.name,
    value: value === undefined || value === '' ? null : value
  })
}

function setInline(port: string, text: string | number | undefined) {
  store.dispatch({
    type: 'inlineChanged',
    nodeId: node.id,
    port,
    text: text === undefined ? '' : String(text)
  })
}

function setRunCount(runCount: number) {
  store.dispatch({ type: 'runCountChanged', nodeId: node.id, runCount })
}

function toggle() {
  store.dispatch({ type: 'settingsToggled', nodeId: node.id })
}
</script>

<template>
  <SettingsCard
    :open="node.settingsOpen"
    :title
    :summary
    :icon
    :credits
    @toggle="toggle"
  >
    <div class="grid grid-cols-2 gap-x-2 gap-y-1">
      <p
        v-for="notice in notices"
        :key="notice"
        class="col-span-2 text-xs text-muted-foreground"
      >
        {{ notice }}
      </p>
      <template v-if="resolving">
        <Skeleton class="h-7" />
        <Skeleton class="h-7" />
      </template>
      <label
        v-for="port in inline"
        :key="port.name"
        class="col-span-2 flex flex-col gap-1"
      >
        <span class="text-xs text-muted-foreground">{{ port.label }}</span>
        <Textarea
          :model-value="node.inline[port.name] ?? ''"
          :aria-label="port.label"
          class="min-h-14 bg-input px-2 py-1 text-xs"
          @update:model-value="setInline(port.name, $event)"
        />
      </label>
      <SettingField
        v-for="spec in settings"
        :key="spec.name"
        :spec
        :model-value="settingValue(spec)"
        @update:model-value="setValue(spec, $event)"
      />
      <label class="flex min-w-0 flex-col gap-1">
        <span class="text-xs text-muted-foreground">
          {{ t('superComfy.node.runs') }}
        </span>
        <NumberField
          :model-value="node.runCount"
          :min="1"
          :max="RUN_LIMIT"
          :step="1"
          :format-options="{ useGrouping: false, maximumFractionDigits: 0 }"
          class="h-7 rounded-md bg-input"
          @update:model-value="setRunCount"
        >
          <NumberFieldInput
            :aria-label="t('superComfy.node.runs')"
            class="text-xs"
          />
        </NumberField>
      </label>
    </div>
  </SettingsCard>
</template>
