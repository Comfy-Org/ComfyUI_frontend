<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { unrefElement } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSuperComfyNavigationStore } from '@/platform/superComfy/stores/superComfyNavigationStore'
import type {
  NodeOutcome,
  RunSummary
} from '@/renderer/extensions/superComfy/engine/types'
import { useSuperComfyGraphStore } from '@/renderer/extensions/superComfy/stores/superComfyGraphStore'

const emit = defineEmits<{ add: [anchor: DOMRect | undefined]; fit: [] }>()

const { t } = useI18n()
const store = useSuperComfyGraphStore()
const navigation = useSuperComfyNavigationStore()
const addButton = useTemplateRef('addButton')

const RAN: ReadonlySet<NodeOutcome> = new Set<NodeOutcome>([
  'complete',
  'partial',
  'failed'
])

function countOutcomes(summary: RunSummary | null) {
  if (!summary?.ok) return null
  const outcomes = Object.values(summary.outcomes)
  return {
    ran: outcomes.filter((outcome) => RAN.has(outcome)).length,
    upToDate: outcomes.filter((outcome) => outcome === 'upToDate').length,
    blocked: outcomes.filter((outcome) => outcome === 'blocked').length
  }
}

const summaryText = computed(() => {
  const counts = countOutcomes(store.lastSummary)
  return counts ? t('superComfy.runSummary', counts) : ''
})

function onAdd() {
  emit('add', unrefElement(addButton)?.getBoundingClientRect())
}

function runGraph() {
  void store.runGraph()
}
</script>

<template>
  <div
    class="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3 text-xs"
  >
    <span class="mr-1 text-sm font-medium text-foreground">
      {{ t('superComfy.title') }}
    </span>
    <Button ref="addButton" variant="secondary" size="sm" @click="onAdd">
      <i class="icon-[lucide--plus] size-3.5" />
      {{ t('superComfy.addNode') }}
    </Button>
    <Button
      v-if="store.isBusy"
      variant="secondary"
      size="sm"
      @click="store.stop()"
    >
      <i class="icon-[lucide--square] size-3" />
      {{ t('superComfy.stop') }}
    </Button>
    <Button v-else variant="inverted" size="sm" @click="runGraph">
      <i class="icon-[lucide--play] size-3" />
      {{ t('superComfy.runGraph') }}
    </Button>
    <Button
      variant="muted-textonly"
      size="icon"
      class="size-6"
      :tooltip="t('superComfy.fitView')"
      :aria-label="t('superComfy.fitView')"
      @click="emit('fit')"
    >
      <i class="icon-[lucide--scan] size-3.5" />
    </Button>
    <span class="min-w-0 flex-1 truncate text-muted-foreground">
      {{ summaryText }}
    </span>
    <span
      v-if="store.saveLocation === 'browser'"
      class="shrink-0 text-muted-foreground"
    >
      {{ t('superComfy.savedInBrowser') }}
    </span>
    <Button variant="secondary" size="sm" @click="navigation.close()">
      <i class="icon-[lucide--arrow-left] size-3.5" />
      {{ t('superComfy.backToGraph') }}
    </Button>
  </div>
</template>
