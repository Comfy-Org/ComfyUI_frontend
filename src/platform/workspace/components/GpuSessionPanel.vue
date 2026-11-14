<template>
  <div class="flex flex-col gap-1 text-xs" data-testid="gpu-session-panel">
    <p v-if="!session">{{ t('gpuSession.panelNone') }}</p>
    <template v-else>
      <p class="font-semibold">
        {{ t('gpuSession.panelSession', { id: short(session.session_id) }) }}
      </p>
      <p>
        {{ t('gpuSession.panelRequests', { count: session.requests ?? 0 }) }}
      </p>
      <p v-if="session.reason">
        {{ t('gpuSession.panelEnded', { reason: session.reason }) }}
      </p>
      <p v-if="machine" class="mt-2 font-semibold">
        {{ t('gpuSession.panelMachine') }}
      </p>
      <p v-if="machine" class="font-mono break-all">{{ machine }}</p>
      <p v-if="runs.length > 0" class="mt-2 font-semibold">
        {{ t('gpuSession.panelRuns') }}
      </p>
      <p
        v-for="run in runs"
        :key="run.id"
        class="font-mono break-all"
        data-testid="gpu-session-run"
      >
        {{ run.line }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { GpuMachine, GpuSessionRun } from '@/platform/workspace/gpuSession'
import { useGpuSessionStore } from '@/platform/workspace/stores/gpuSessionStore'

const { t } = useI18n()
const { session } = storeToRefs(useGpuSessionStore())

function short(id: string) {
  return id.slice(0, 8)
}

function machineLine(machine: GpuMachine) {
  return [
    machine.gpu_name,
    machine.hostname,
    machine.task_id ?? machine.container_id
  ]
    .filter(Boolean)
    .join(' · ')
}

function sameMachineLabel(run: GpuSessionRun) {
  if (run.same_machine === undefined) return ''
  return t(
    run.same_machine ? 'gpuSession.sameMachine' : 'gpuSession.otherMachine'
  )
}

const machine = computed(() =>
  session.value?.machine ? machineLine(session.value.machine) : ''
)

const runs = computed(() =>
  (session.value?.runs ?? []).map((run) => ({
    id: run.job_id,
    line: [short(run.job_id), run.status, sameMachineLabel(run)]
      .filter(Boolean)
      .join(' · ')
  }))
)
</script>
