<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowUpRight,
  ChevronLeft,
  Play,
  Download,
  Workflow
} from '@lucide/vue'
import type { CuratedWorkflow } from '../../config/workflow-catalogue'
import {
  TEMPLATE_REVISION,
  templateAsset,
  workflowMetadata
} from '../../config/workflow-catalogue'
import type { WorkflowGraph as Graph } from '../../config/workflow-execution'
import {
  WORKSHOP_CLOUD_BASE_URL,
  WORKSHOP_CREDITS_URL
} from '../../config/workshop-env'
import { useWorkflowRun } from '../../composables/useWorkflowRun'
import WorkflowGraph from './WorkflowGraph.vue'
import WorkshopBrowseTabs from './WorkshopBrowseTabs.vue'

const { workflow, graph } = defineProps<{
  workflow: CuratedWorkflow
  graph: Graph
}>()
const metadata = workflowMetadata(workflow)
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
} = useWorkflowRun(workflow, graph)
const section = ref('playground')
const cloudHref = `${WORKSHOP_CLOUD_BASE_URL}/?template=${encodeURIComponent(workflow.template)}`
const statusLabel = computed(() => {
  if (state.value.phase === 'uploading') return 'Uploading inputs…'
  if (state.value.phase === 'submitting') return 'Submitting workflow…'
  if (state.value.phase === 'reconnecting') return 'Reconnecting to your run…'
  if (state.value.phase === 'tracking')
    return state.value.job.status === 'pending'
      ? 'Queued in Cloud…'
      : 'Running workflow…'
  return 'Run workflow'
})
const signInHref =
  '/login/?returnTo=' +
  encodeURIComponent(`/models/workflows/${workflow.slug}/`)
function changedFile(key: string, event: Event) {
  const input = event.target
  if (input instanceof HTMLInputElement && input.files?.[0])
    selectFile(key, input.files[0])
}
function downloadGraph() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' })
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${workflow.slug}.api.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <div class="mx-auto max-w-10xl px-6 pt-5 pb-20 lg:px-8">
    <WorkshopBrowseTabs active="workflows" />
    <a
      href="/models/workflows/"
      class="mb-7 inline-flex min-h-11 items-center gap-1 text-sm text-primary-warm-gray hover:text-primary-comfy-yellow"
      ><ChevronLeft class="size-4" /> All workflows</a
    >
    <header class="mb-9">
      <p class="mb-3 text-sm text-primary-comfy-yellow">
        {{ workflow.category }}
      </p>
      <h1
        class="max-w-4xl text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
      >
        {{ workflow.title }}
      </h1>
      <p class="mt-4 max-w-3xl text-lg text-primary-warm-gray">
        {{ workflow.description }}
      </p>
      <div class="mt-5 flex flex-wrap gap-2 text-xs text-primary-warm-gray">
        <span
          v-for="model in metadata.models"
          :key="model"
          class="rounded-full border border-transparency-white-t20 px-3 py-1.5"
          >{{ model }}</span
        >
        <span class="px-2 py-1.5">Template by {{ metadata.author }}</span>
      </div>
    </header>

    <div class="mb-6 flex gap-7 border-b border-transparency-white-t8">
      <button
        v-for="item in ['playground', 'workflow', 'api']"
        :key="item"
        type="button"
        :aria-pressed="section === item"
        class="min-h-12 border-b-2 px-1 text-sm font-medium uppercase transition-colors hover:text-primary-comfy-yellow"
        :class="
          section === item
            ? 'border-primary-comfy-yellow text-primary-comfy-canvas'
            : 'border-transparent text-primary-warm-gray'
        "
        @click="section = item"
      >
        {{ item }}
      </button>
    </div>

    <div
      v-show="section === 'playground'"
      class="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
    >
      <form
        class="overflow-hidden rounded-2xl border border-transparency-white-t20"
        @submit.prevent="run"
      >
        <fieldset :disabled="busy" class="space-y-6 p-5 lg:p-6">
          <legend class="sr-only">Workflow inputs</legend>
          <div>
            <h2 class="text-lg font-medium text-primary-comfy-canvas">
              Make it yours
            </h2>
            <p class="mt-1 text-sm text-primary-warm-gray">
              Start with the example inputs or upload your own.
            </p>
          </div>
          <div
            v-for="(field, index) in workflow.fields"
            :key="`${field.node}.${field.input}`"
          >
            <label
              :for="`input-${index}`"
              class="mb-2.5 block text-sm font-medium text-primary-comfy-canvas"
              >{{ index + 1 }}. {{ field.label }}</label
            >
            <p
              v-if="field.help"
              :id="`input-help-${index}`"
              class="mb-3 text-sm/relaxed text-primary-warm-gray"
            >
              {{ field.help }}
            </p>
            <template v-if="['image', 'video', 'audio'].includes(field.kind)">
              <div
                class="overflow-hidden rounded-xl border border-transparency-white-t8 bg-transparency-white-t8"
              >
                <img
                  v-if="
                    field.kind === 'image' &&
                    inputPreview(`${field.node}.${field.input}`)
                  "
                  :src="inputPreview(`${field.node}.${field.input}`)"
                  :alt="field.label"
                  class="h-44 w-full object-contain"
                />
                <video
                  v-else-if="field.kind === 'video'"
                  :src="inputPreview(`${field.node}.${field.input}`)"
                  controls
                  preload="metadata"
                  class="h-44 w-full"
                />
                <audio
                  v-else-if="field.kind === 'audio'"
                  :src="inputPreview(`${field.node}.${field.input}`)"
                  controls
                  preload="metadata"
                  class="my-5 w-full"
                />
                <input
                  :id="`input-${index}`"
                  type="file"
                  :aria-describedby="
                    field.help ? `input-help-${index}` : undefined
                  "
                  :required="!inputPreview(`${field.node}.${field.input}`)"
                  :accept="`${field.kind}/*`"
                  class="block w-full cursor-pointer p-3 text-xs text-primary-warm-gray file:mr-3 file:rounded-lg file:border-0 file:bg-transparency-white-t8 file:px-3 file:py-2 file:text-primary-comfy-canvas"
                  @change="changedFile(`${field.node}.${field.input}`, $event)"
                />
              </div>
            </template>
            <textarea
              v-else-if="field.kind === 'text'"
              :id="`input-${index}`"
              v-model="values[`${field.node}.${field.input}`]"
              required
              rows="4"
              class="w-full resize-y rounded-xl border border-transparency-white-t20 bg-transparent p-3 text-sm/relaxed text-primary-comfy-canvas focus:border-primary-comfy-yellow focus:outline-none"
            />
            <input
              v-else
              :id="`input-${index}`"
              v-model="values[`${field.node}.${field.input}`]"
              type="number"
              required
              :min="field.min"
              :max="field.max"
              :step="field.step"
              class="h-12 w-full rounded-xl border border-transparency-white-t20 bg-transparent px-3 text-primary-comfy-canvas focus:border-primary-comfy-yellow focus:outline-none"
            />
          </div>
        </fieldset>
        <div class="space-y-3 border-t border-transparency-white-t8 p-5 lg:p-6">
          <p class="text-xs/relaxed text-primary-warm-gray">
            Runs on your Cloud account. Your plan and compute credits apply.
          </p>
          <button
            v-if="session || !settled"
            type="submit"
            :disabled="
              busy || !session || (state.phase === 'error' && !state.retrySafe)
            "
            class="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-comfy-yellow px-5 text-sm font-bold text-primary-comfy-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play class="size-4" />{{
              !settled ? 'Checking account…' : statusLabel
            }}
          </button>
          <a
            v-else
            :href="signInHref"
            target="_blank"
            rel="noopener"
            class="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-comfy-yellow px-5 text-sm font-bold text-primary-comfy-ink"
            >Sign in to run <ArrowUpRight class="size-4"
          /></a>
          <a
            :href="cloudHref"
            target="_blank"
            rel="noopener"
            class="flex h-12 items-center justify-center gap-2 rounded-xl border border-transparency-white-t20 text-sm font-medium text-primary-comfy-canvas hover:bg-transparency-white-t8"
            >Try in Cloud <ArrowUpRight class="size-4"
          /></a>
          <p class="text-center text-xs text-primary-warm-gray">
            Open a copy on your canvas to edit the nodes.
          </p>
        </div>
      </form>

      <div class="space-y-4 lg:sticky lg:top-24">
        <section
          class="overflow-hidden rounded-2xl border border-transparency-white-t20"
        >
          <div
            class="flex items-center justify-between gap-4 border-b border-transparency-white-t8 px-5 py-4"
          >
            <h2 class="font-medium text-primary-comfy-canvas">
              {{ outputs.length ? 'Your results' : 'Result' }}
            </h2>
            <span v-if="!outputs.length" class="text-xs text-primary-warm-gray"
              >Example preview</span
            >
          </div>
          <div
            v-if="!outputs.length"
            class="relative flex min-h-80 items-center justify-center bg-transparency-white-t8 p-4"
          >
            <img
              :src="metadata.thumbnail"
              :alt="`Example: ${workflow.title}`"
              class="max-h-130 w-full rounded-lg object-contain"
              :class="busy ? 'opacity-25' : ''"
            />
            <div
              v-if="busy"
              role="status"
              aria-live="polite"
              class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-primary-comfy-canvas"
            >
              <Workflow class="size-8 animate-pulse" />
              <p>{{ statusLabel }}</p>
              <p class="max-w-sm text-sm text-primary-warm-gray">
                Your result will appear here. Keep this page open while the
                workflow runs.
              </p>
              <button
                v-if="state.phase === 'tracking'"
                type="button"
                class="min-h-11 rounded-lg border border-transparency-white-t20 px-5 text-sm"
                @click="cancel"
              >
                Cancel run
              </button>
            </div>
          </div>
          <div v-for="output in outputs" :key="output.url" class="p-4">
            <img
              v-if="output.mime.startsWith('image/')"
              :src="output.url"
              :alt="output.name"
              class="max-h-150 w-full object-contain"
            />
            <video
              v-else-if="output.mime.startsWith('video/')"
              :src="output.url"
              controls
              class="w-full"
            />
            <audio
              v-else-if="output.mime.startsWith('audio/')"
              :src="output.url"
              controls
              class="w-full"
            />
            <a
              :href="output.url"
              :download="output.name"
              class="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-primary-comfy-yellow"
              ><Download class="size-4" /> Download {{ output.name }}</a
            >
          </div>
          <p
            v-if="!outputs.length && !busy"
            class="px-5 py-4 text-sm text-primary-warm-gray"
          >
            An example from this template. Run the workflow to generate your own
            result.
          </p>
        </section>
        <div
          v-if="state.phase === 'error'"
          role="alert"
          class="rounded-xl border border-transparency-white-t20 p-5 text-sm text-primary-comfy-canvas"
        >
          <p>{{ state.message }}</p>
          <button
            v-if="state.jobId"
            class="mt-3 min-h-11 text-primary-comfy-yellow"
            @click="resume"
          >
            Reconnect to this run
          </button>
          <a
            :href="WORKSHOP_CREDITS_URL"
            target="_blank"
            rel="noopener"
            class="mt-3 block min-h-11 text-primary-comfy-yellow"
            >Check plan and credits in Cloud ↗</a
          >
        </div>
        <p
          v-if="
            state.phase === 'finished' &&
            state.job.status === 'completed' &&
            !outputs.length
          "
          role="status"
          class="rounded-xl border border-transparency-white-t20 p-5 text-sm text-primary-comfy-canvas"
        >
          This run finished without a downloadable output. Open Cloud to inspect
          the job.
        </p>
        <div
          v-if="state.phase === 'finished' && state.job.status !== 'completed'"
          role="status"
          class="rounded-xl border border-transparency-white-t20 p-5 text-sm text-primary-comfy-canvas"
        >
          {{
            state.job.status === 'cancelled'
              ? 'Run cancelled.'
              : (state.job.execution_error?.exception_message ??
                'The workflow could not finish. Try again or open it in Cloud.')
          }}
        </div>
        <p
          v-if="state.phase === 'tracking' || state.phase === 'finished'"
          class="text-xs break-all text-primary-warm-gray"
        >
          Job ID: {{ state.job.id }}
        </p>
      </div>
    </div>

    <div v-show="section === 'workflow'" class="space-y-6">
      <WorkflowGraph :graph />
      <div class="flex flex-wrap items-center gap-5 text-sm">
        <a
          :href="templateAsset('templates', `${workflow.template}.json`)"
          target="_blank"
          rel="noopener"
          class="text-primary-comfy-yellow"
          >View original template ↗</a
        ><a
          :href="cloudHref"
          target="_blank"
          rel="noopener"
          class="text-primary-comfy-yellow"
          >Edit a copy in Cloud ↗</a
        ><span class="text-primary-warm-gray"
          >Pinned template revision {{ TEMPLATE_REVISION.slice(0, 7) }}</span
        >
      </div>
    </div>
    <section
      v-show="section === 'api'"
      class="max-w-3xl rounded-2xl border border-transparency-white-t20 p-7"
    >
      <h2 class="text-2xl text-primary-comfy-canvas">
        Build with this workflow
      </h2>
      <p class="mt-3 leading-relaxed text-primary-warm-gray">
        Download the API-format graph to integrate this workflow into your app.
        Upload your input files and bind their references before submitting a
        job.
      </p>
      <div class="mt-6 flex flex-wrap gap-4">
        <button
          class="min-h-11 rounded-xl border border-transparency-white-t20 px-5 text-sm text-primary-comfy-canvas"
          @click="downloadGraph"
        >
          Download API graph</button
        ><a
          href="https://docs.comfy.org/api-reference/v2/overview"
          target="_blank"
          rel="noopener"
          class="inline-flex min-h-11 items-center gap-2 text-sm text-primary-comfy-yellow"
          >API documentation <ArrowUpRight class="size-4"
        /></a>
      </div>
      <a
        href="https://platform.comfy.org/profile/builds"
        target="_blank"
        rel="noopener"
        class="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-primary-comfy-yellow"
        >Deploy with the Developer Platform <ArrowUpRight class="size-4"
      /></a>
    </section>

    <section class="mt-14">
      <h2 class="mb-5 text-2xl font-light text-primary-comfy-canvas">
        Explore the possibilities
      </h2>
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <figure
          v-for="(src, index) in metadata.examples"
          :key="src"
          class="overflow-hidden rounded-2xl border border-transparency-white-t8"
        >
          <img
            :src="src"
            :alt="`${workflow.title}, template example ${index + 1}`"
            loading="lazy"
            class="aspect-4/3 w-full object-cover"
          />
          <figcaption class="p-4 text-sm text-primary-warm-gray">
            Template example {{ index + 1 }}
          </figcaption>
        </figure>
      </div>
      <a
        href="/models/"
        class="mt-8 inline-flex min-h-11 items-center gap-2 text-sm text-primary-comfy-yellow"
        >Explore the models behind your workflows <ArrowUpRight class="size-4"
      /></a>
    </section>
  </div>
</template>
