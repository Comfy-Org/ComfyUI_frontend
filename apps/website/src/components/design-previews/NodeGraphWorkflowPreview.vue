<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

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

type Key = 'version'
const fields: readonly PrototypeField<Key>[] = [
  {
    key: 'version',
    label: 'Try in Cloud',
    options: [
      { value: 'a', label: 'A: secondary at top, yellow in About' },
      { value: 'b', label: 'B: yellow at top only' }
    ]
  }
]
const defaults: Record<Key, string> = { version: 'a' }
const STORAGE_KEY = 'hub-preview:node-graph-cta'

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
  url.search = ''
  for (const field of fields) url.searchParams.set(field.key, value[field.key])
  history.replaceState(history.state, '', url)
  writeSaved(value)
})

const workflow = {
  ...nodeGraphSamples.turnaround,
  inputs: inputs.turnaround
}
</script>

<template>
  <WorkflowNodeGraphPage
    :workflow="workflow"
    :locale="locale"
    :primary-action="state.version === 'b' ? 'header' : 'panel'"
  />
  <PrototypeSwitcher v-model="state" :fields="fields" />
</template>
