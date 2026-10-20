<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import WorkflowNodeGraphPage from '@/components/workshop/WorkflowNodeGraphPage.vue'
import type { Locale } from '@/i18n/translations'
import type { NodeGraphInput } from '@/lib/hub/node-graph-inputs'
import type { SampleKey } from '@/lib/hub/node-graph-workflow'
import { nodeGraphSamples } from '@/lib/hub/node-graph-workflow'

import type { PrototypeField } from './PrototypeSwitcher.vue'
import PrototypeSwitcher from './PrototypeSwitcher.vue'
import { resolvePrototypeState } from './prototype-state'

const { locale = 'en', inputs } = defineProps<{
  locale?: Locale
  inputs: Readonly<Record<SampleKey, readonly NodeGraphInput[]>>
}>()

type Key = 'workflow' | 'cloud' | 'examples' | 'nodes' | 'faq'
const fields: readonly PrototypeField<Key>[] = [
  {
    key: 'workflow',
    label: 'Workflow',
    options: [
      { value: 'turnaround', label: 'Character turnaround' },
      { value: 'fasth3', label: 'FastH3 image to video' }
    ]
  },
  {
    key: 'cloud',
    label: 'Availability',
    options: [
      { value: 'yes', label: 'Try in Cloud' },
      { value: 'no', label: 'Local only' }
    ]
  },
  {
    key: 'examples',
    label: 'Sample outputs',
    options: [
      { value: '3', label: '3 samples' },
      { value: '1', label: '1 sample' },
      { value: '0', label: 'No samples' }
    ]
  },
  {
    key: 'nodes',
    label: 'Custom nodes',
    options: [
      { value: 'yes', label: 'Needs custom nodes' },
      { value: 'no', label: 'Core nodes only' }
    ]
  },
  {
    key: 'faq',
    label: 'FAQ',
    options: [
      { value: 'yes', label: 'FAQ' },
      { value: 'no', label: 'No FAQ' }
    ]
  }
]
const defaults: Record<Key, string> = {
  workflow: 'turnaround',
  cloud: 'yes',
  examples: '3',
  nodes: 'yes',
  faq: 'yes'
}
const STORAGE_KEY = 'hub-preview:node-graph'

const state = ref<Record<Key, string>>({ ...defaults })

function readSaved(): Partial<Record<Key, string>> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeSaved(value: Record<Key, string>): boolean {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

onMounted(() => {
  state.value = resolvePrototypeState(
    fields,
    defaults,
    new URLSearchParams(window.location.search),
    readSaved()
  )
})

watch(state, (value) => {
  const url = new URL(window.location.href)
  for (const field of fields) url.searchParams.set(field.key, value[field.key])
  history.replaceState(history.state, '', url)
  writeSaved(value)
})

const workflow = computed(() => {
  const key: SampleKey =
    state.value.workflow === 'fasth3' ? 'fasth3' : 'turnaround'
  const sample = nodeGraphSamples[key]
  return {
    ...sample,
    inputs: inputs[key],
    examples: sample.examples.slice(0, Number(state.value.examples)),
    customNodes: state.value.nodes === 'yes' ? sample.customNodes : [],
    faq: state.value.faq === 'yes' ? sample.faq : []
  }
})
</script>

<template>
  <WorkflowNodeGraphPage
    :key="workflow.slug"
    :workflow="workflow"
    :locale="locale"
    :cloud-available="state.cloud === 'yes'"
  />
  <PrototypeSwitcher v-model="state" :fields="fields" />
</template>
