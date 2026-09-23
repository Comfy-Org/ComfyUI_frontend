<script setup lang="ts">
import { computed } from 'vue'

import type { WorkflowField } from '../../config/workflow-fields'
import type { WorkflowGraph } from '../../config/workflow-execution'
import { useWorkflowRun } from '../../composables/useWorkflowRun'
import { useSignInHref } from '../../composables/useSignInHref'
import { leaveForSignIn } from '../../config/workshop-return'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import Button from '../ui/button/Button.vue'

// The workflow, run where it actually runs. Cloud takes the whole graph in the
// request, so the page fills the inputs the bindings name and sends it; there
// is no per-workflow endpoint to wait for.
const {
  fields,
  graph,
  coldStart = false,
  locale = 'en'
} = defineProps<{
  fields: readonly WorkflowField[]
  graph: WorkflowGraph
  /**
   * Whether this one wakes a server of its own before it can start. Shared
   * Cloud is already awake, so its wait is a queue; a cold start is a
   * different wait and is told as one.
   */
  coldStart?: boolean
  locale?: Locale
}>()

const {
  state,
  values,
  outputs,
  busy,
  session,
  settled,
  selectFile,
  inputPreview,
  run,
  resume,
  cancel
} = useWorkflowRun(fields, graph)

const signInHref = useSignInHref(locale)

const key = (field: WorkflowField) => `${field.node}.${field.input}`

const media = (field: WorkflowField) =>
  ['image', 'video', 'audio'].includes(field.kind)

const accept: Record<string, string> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*'
}

// What the reader is waiting for, in the order it happens. A shared Cloud run
// queues and generates; one on its own server wakes it and loads the models
// first, which is the long part and the part worth naming.
const steps = computed(() =>
  coldStart
    ? ([
        'workshop.v2.run.waking',
        'workshop.v2.run.loading',
        'workshop.v2.run.generating'
      ] as const)
    : (['workshop.v2.run.queued', 'workshop.v2.run.generating'] as const)
)

const reached = computed(() => {
  const phase = state.value.phase
  if (phase === 'uploading' || phase === 'submitting') return 0
  if (phase === 'tracking')
    return state.value.job.status === 'pending' ? 0 : steps.value.length - 1
  if (phase === 'finished') return steps.value.length
  return -1
})

const status = computed(() => {
  const phase = state.value.phase
  if (phase === 'uploading') return t('workshop.v2.run.uploading', locale)
  if (phase === 'submitting') return t('workshop.v2.run.sending', locale)
  if (phase === 'reconnecting') return t('workshop.v2.run.reconnecting', locale)
  if (phase === 'tracking')
    return t(steps.value[Math.max(reached.value, 0)], locale)
  return ''
})

function chooseFile(field: WorkflowField, event: Event) {
  const input = event.target
  if (input instanceof HTMLInputElement && input.files?.[0])
    selectFile(key(field), input.files[0])
}

const fieldLabel = 'text-xs font-bold tracking-wider text-content uppercase'
const box =
  'w-full rounded-xl border border-transparency-white-t8 bg-hub-surface p-3 text-sm text-content outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
</script>

<template>
  <section class="flex flex-col gap-6" data-testid="workflow-run-form">
    <div class="flex flex-col gap-5">
      <div
        v-for="field in fields"
        :key="key(field)"
        class="flex flex-col gap-2"
      >
        <label :class="fieldLabel" :for="key(field)">{{ field.label }}</label>

        <template v-if="media(field)">
          <img
            v-if="field.kind === 'image' && inputPreview(key(field))"
            :src="inputPreview(key(field))"
            alt=""
            class="aspect-video w-full rounded-xl bg-hub-surface object-cover"
            data-testid="workflow-run-preview"
          />
          <input
            :id="key(field)"
            type="file"
            :accept="accept[field.kind]"
            :disabled="busy"
            class="text-sm text-content-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-hub-surface-hover file:px-3 file:py-2 file:text-sm file:text-content"
            :data-testid="`workflow-run-file-${field.node}`"
            @change="chooseFile(field, $event)"
          />
        </template>

        <textarea
          v-else-if="field.kind === 'text'"
          :id="key(field)"
          v-model="values[key(field)]"
          rows="3"
          :disabled="busy"
          :class="box"
          :data-testid="`workflow-run-text-${field.node}`"
        />

        <input
          v-else
          :id="key(field)"
          v-model="values[key(field)]"
          type="number"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          :disabled="busy"
          :class="box"
        />
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <Button
        v-if="settled && !session"
        as="a"
        :href="signInHref"
        size="lg"
        class="w-full"
        data-testid="workflow-run-signin"
        @click="leaveForSignIn($event, signInHref)"
      >
        {{ t('workshop.run.signIn', locale) }}
      </Button>

      <Button
        v-else
        size="lg"
        class="w-full"
        :disabled="busy || !settled"
        data-testid="workflow-run-button"
        @click="run"
      >
        {{ t('workshop.v2.run.run', locale) }}
      </Button>

      <Button
        v-if="state.phase === 'tracking'"
        variant="outline"
        size="sm"
        class="w-full"
        data-testid="workflow-run-cancel"
        @click="cancel"
      >
        {{ t('workshop.v2.run.cancel', locale) }}
      </Button>
    </div>

    <!-- The wait, told as the steps it actually has. A reader who knows a
      cold start is coming reads a slow first run as the shape of the thing
      rather than as a page that has stopped answering. -->
    <ol
      v-if="busy || state.phase === 'finished'"
      class="flex flex-col gap-2"
      data-testid="workflow-run-steps"
    >
      <li
        v-for="(step, index) in steps"
        :key="step"
        class="flex items-center gap-3 text-sm"
        :class="
          index <= reached ? 'text-content' : 'text-content-muted opacity-60'
        "
      >
        <span
          class="size-2 shrink-0 rounded-full"
          :class="index <= reached ? 'bg-primary-comfy-yellow' : 'bg-hub-muted'"
        />
        {{ t(step, locale) }}
      </li>
    </ol>

    <p v-if="status" class="text-sm text-content-muted">{{ status }}</p>

    <!-- An error says which of the two things happened, because only one of
      them is safe to simply try again. -->
    <div
      v-if="state.phase === 'error'"
      class="border-danger/40 flex flex-col gap-3 rounded-xl border p-4"
      data-testid="workflow-run-error"
    >
      <p class="text-sm text-content">{{ state.message }}</p>
      <Button
        v-if="state.jobId"
        variant="outline"
        size="sm"
        data-testid="workflow-run-resume"
        @click="resume"
      >
        {{ t('workshop.v2.run.resume', locale) }}
      </Button>
    </div>

    <div v-if="outputs.length" class="flex flex-col gap-3">
      <div v-for="output in outputs" :key="output.url">
        <video
          v-if="output.mime.startsWith('video/')"
          :src="output.url"
          controls
          playsinline
          class="w-full rounded-2xl bg-hub-surface"
          data-testid="workflow-run-output"
        />
        <img
          v-else
          :src="output.url"
          :alt="output.name"
          class="w-full rounded-2xl bg-hub-surface"
          data-testid="workflow-run-output"
        />
      </div>
    </div>
  </section>
</template>
