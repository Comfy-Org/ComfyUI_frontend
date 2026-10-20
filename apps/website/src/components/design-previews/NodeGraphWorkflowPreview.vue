<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import WorkflowNodeGraphPage from '@/components/workshop/WorkflowNodeGraphPage.vue'
import type { Locale } from '@/i18n/translations'
import { nodeGraphWorkflowSample } from '@/lib/hub/node-graph-workflow'

import type { PrototypeField } from './PrototypeSwitcher.vue'
import PrototypeSwitcher from './PrototypeSwitcher.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

type Key = 'cloud' | 'examples' | 'nodes' | 'faq'
const fields: readonly PrototypeField<Key>[] = [
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
      { value: 'yes', label: 'Custom nodes' },
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

// Read once from the URL, falling back to this tab's last choice; every
// change is written back so a state can be shared as a link.
onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const saved = readSaved()
  const next = { ...defaults }
  for (const field of fields) {
    const value = params.get(field.key) ?? saved[field.key]
    if (value && field.options.some((option) => option.value === value))
      next[field.key] = value
  }
  state.value = next
})

watch(state, (value) => {
  const url = new URL(window.location.href)
  for (const field of fields) url.searchParams.set(field.key, value[field.key])
  history.replaceState(history.state, '', url)
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Storage can be unavailable; the URL still holds the state.
  }
})

const workflow = computed(() => ({
  ...nodeGraphWorkflowSample,
  examples: nodeGraphWorkflowSample.examples.slice(
    0,
    Number(state.value.examples)
  ),
  customNodes:
    state.value.nodes === 'yes' ? nodeGraphWorkflowSample.customNodes : [],
  faq: state.value.faq === 'yes' ? nodeGraphWorkflowSample.faq : []
}))
</script>

<template>
  <WorkflowNodeGraphPage
    :workflow="workflow"
    :locale="locale"
    :cloud-available="state.cloud === 'yes'"
  />
  <PrototypeSwitcher v-model="state" :fields="fields" />
</template>
