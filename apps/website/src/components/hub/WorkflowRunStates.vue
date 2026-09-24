<script setup lang="ts">
import { SlidersHorizontal, X } from '@lucide/vue'
import { computed, ref } from 'vue'

import type { WorkflowReach } from '../../lib/hub/workflow-reach'
import { previewScene } from '../../lib/hub/run-preview'
import { RUN_SCENES } from '../../lib/hub/run-scenes'

// A reference tool, not part of the page: it sits closed in the corner, out
// of the way of the thing being looked at, and opens when it is asked to.
// Which kind a workflow is decides how its page is built, so that handle
// walks to a page that genuinely is that kind; the state of a run is the
// panel's own, so that one is handed straight to it.
const { examples, hasPanel = false } = defineProps<{
  /** One real workflow of each kind, named when the catalogue holds one. */
  examples: Partial<Record<WorkflowReach, string>>
  /** Whether this page draws a run panel for the state to land in. */
  hasPanel?: boolean
}>()

const REACH_NAMES: Record<WorkflowReach, string> = {
  cloud: 'Runs on Cloud',
  here: 'Runs here, through one model call',
  endpoint: 'Needs a server of its own'
}

const open = ref(false)

const kinds = computed(() =>
  (Object.keys(REACH_NAMES) as WorkflowReach[])
    .filter((reach) => examples[reach])
    .map((reach) => ({
      reach,
      name: REACH_NAMES[reach],
      href: `/hub/workflow/${examples[reach]}/`
    }))
)

const sceneName = computed({
  get: () => previewScene.value?.name ?? '',
  set: (name: string) => {
    previewScene.value = RUN_SCENES.find((scene) => scene.name === name)
  }
})

function walkTo(href: string) {
  if (href) window.location.href = href
}

const field =
  'w-full cursor-pointer rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink px-2 py-1.5 text-xs text-primary-warm-white'
</script>

<template>
  <div
    class="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2"
    data-testid="workflow-run-states"
  >
    <div
      v-if="open"
      class="flex w-72 flex-col gap-4 rounded-2xl border border-transparency-white-t20 bg-primary-comfy-ink/95 p-4 shadow-2xl backdrop-blur-md"
    >
      <label class="flex flex-col gap-1.5">
        <span
          class="text-2xs font-bold tracking-wider text-primary-warm-gray uppercase"
        >
          Kind of workflow
        </span>
        <select
          :class="field"
          data-testid="workflow-run-states-kind"
          @change="walkTo(($event.target as HTMLSelectElement).value)"
        >
          <option value="">Go to a workflow that…</option>
          <option v-for="kind in kinds" :key="kind.reach" :value="kind.href">
            {{ kind.name }}
          </option>
        </select>
      </label>

      <label class="flex flex-col gap-1.5">
        <span
          class="text-2xs font-bold tracking-wider text-primary-warm-gray uppercase"
        >
          State of the run
        </span>
        <select
          v-model="sceneName"
          :class="field"
          :disabled="!hasPanel"
          data-testid="workflow-run-states-scene"
        >
          <option value="">Live</option>
          <option v-for="scene in RUN_SCENES" :key="scene.name">
            {{ scene.name }}
          </option>
        </select>
        <span v-if="!hasPanel" class="text-2xs text-primary-warm-gray">
          This kind of workflow has no panel to stand a state up in.
        </span>
      </label>
    </div>

    <button
      type="button"
      class="grid size-11 cursor-pointer place-items-center rounded-full border border-transparency-white-t20 bg-primary-comfy-ink/95 text-primary-comfy-yellow shadow-2xl backdrop-blur-md"
      :aria-expanded="open"
      aria-label="Preview states"
      data-testid="workflow-run-states-toggle"
      @click="open = !open"
    >
      <X v-if="open" class="size-5" />
      <SlidersHorizontal v-else class="size-5" />
    </button>
  </div>
</template>
