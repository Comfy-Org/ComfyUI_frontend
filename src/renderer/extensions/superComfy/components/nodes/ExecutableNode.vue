<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { SuperCanvasKey } from '@/renderer/extensions/superComfy/canvas/canvasContext'
import type {
  ExecutableNode,
  Modality
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import { portsOf } from '@/renderer/extensions/superComfy/engine/graphTopology'
import {
  activityOf,
  nodeProgress,
  plannedRunCount,
  visibleMissingPorts
} from '@/renderer/extensions/superComfy/engine/selectors'
import {
  RUN_LIMIT,
  useSuperComfyGraphStore
} from '@/renderer/extensions/superComfy/stores/superComfyGraphStore'
import { modalityIcon } from '@/renderer/extensions/superComfy/superComfyModality'

import BatchBar from './BatchBar.vue'
import ExecutableHeader from './ExecutableHeader.vue'
import ExecutableSettings from './ExecutableSettings.vue'
import MediaBatchPreview from './MediaBatchPreview.vue'
import NodeShell from './NodeShell.vue'
import { batchEntries, nodeStatus } from './nodeView'
import { useBatchIndex } from './useBatchIndex'

const { node, selected } = defineProps<{
  node: ExecutableNode
  selected: boolean
}>()

const { t } = useI18n()
const store = useSuperComfyGraphStore()
const canvas = inject(SuperCanvasKey, null)

const ports = computed(() => portsOf(node))
const activity = computed(() => activityOf(store.state, node.id))
const plan = computed(() =>
  plannedRunCount(store.state.doc, node.id, RUN_LIMIT)
)
const missing = computed(() => visibleMissingPorts(store.state, node.id))
const running = computed(() => activity.value.phase === 'running')
const busy = computed(() => running.value || activity.value.phase === 'waiting')
const progress = computed(() => {
  const counts = nodeProgress(activity.value)
  return counts && counts.total > 0 ? counts.settled / counts.total : null
})
const status = computed(() =>
  nodeStatus({
    node,
    activity: activity.value,
    plan: plan.value,
    missing: missing.value,
    error: store.nodeErrors[node.id]
  })
)

const ownSession = computed(() => {
  const current = activity.value
  if (current.phase !== 'running' && current.phase !== 'waiting') return null
  return store.state.runtime.sessions[current.sessionId]?.scope === 'node'
    ? current.sessionId
    : null
})
const graphRunning = computed(() =>
  Object.values(store.state.runtime.sessions).some(
    ({ scope }) => scope === 'graph'
  )
)

const chosenOutput = ref<string | null>(null)
const activeOutput = computed(
  () =>
    ports.value.outputs.find(({ name }) => name === chosenOutput.value)?.name ??
    ports.value.outputs[0]?.name ??
    'out'
)
const entries = computed(() => batchEntries(node, activeOutput.value))
const index = useBatchIndex(() => entries.value.length)

const previewModality = computed<Modality>(
  () =>
    ports.value.outputs.find(({ name }) => name === activeOutput.value)
      ?.modality ?? (node.kind === 'generate' ? node.modality : 'image')
)

function run() {
  void store.runNode(node.id)
}

function stop() {
  if (ownSession.value) store.stop(ownSession.value)
}
</script>

<template>
  <NodeShell
    :node-id="node.id"
    :inputs="ports.inputs"
    :outputs="ports.outputs"
    :selected
    :running
    :missing
    :show-labels="selected || (canvas?.draftActive.value ?? false)"
    :progress
  >
    <template #header>
      <ExecutableHeader
        :node
        :status
        :plan
        :running="ownSession !== null"
        :disabled="graphRunning"
        :emphasized="selected || busy"
        @run="run"
        @stop="stop"
      />
    </template>
    <template #preview>
      <div v-if="ports.outputs.length > 1" class="flex gap-1 p-1" data-no-drag>
        <Button
          v-for="output in ports.outputs"
          :key="output.name"
          :variant="
            output.name === activeOutput ? 'secondary' : 'muted-textonly'
          "
          size="sm"
          :aria-label="t('superComfy.node.showOutput', { name: output.label })"
          @click="chosenOutput = output.name"
        >
          {{ output.label }}
        </Button>
      </div>
      <MediaBatchPreview
        v-model:index="index"
        :entries
        :selected
        :dimmed="busy"
      >
        <template #empty>
          <div class="flex flex-1 items-center justify-center py-10">
            <i
              :class="
                cn(
                  'size-6 text-muted-foreground/50',
                  modalityIcon(previewModality)
                )
              "
            />
          </div>
        </template>
      </MediaBatchPreview>
    </template>
    <template #gap>
      <BatchBar v-model="index" :count="entries.length" />
    </template>
    <template #settings>
      <ExecutableSettings :node />
    </template>
  </NodeShell>
</template>
