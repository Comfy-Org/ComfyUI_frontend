<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, useTemplateRef } from 'vue'
import { Check, ChevronLeft, Copy, Play, Server, Workflow } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { CuratedWorkflow } from '../../config/workflow-catalogue'
import {
  templateAsset,
  workflowMetadata
} from '../../config/workflow-catalogue'
import type { DemoEvent, DemoPhase } from '../../config/workflow-demo'
import {
  demoSteps,
  demoVideo,
  transitionDemo
} from '../../config/workflow-demo'
import Button from '../ui/button/Button.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogContent from '../ui/dialog/DialogContent.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'
import DialogDescription from '../ui/dialog/DialogDescription.vue'
import WorkshopBrowseTabs from './WorkshopBrowseTabs.vue'
import WorkflowGraph from './WorkflowGraph.vue'
import WorkflowDetailTabs from './WorkflowDetailTabs.vue'
import WorkflowApiTab from './WorkflowApiTab.vue'
import demoGraph from '../../data/workflows/template_ltx2_3_obscura_remova_lora_remove_object_from_video.json'
import { workflowGraphSchema } from '../../config/workflow-execution'

const { workflow } = defineProps<{ workflow: CuratedWorkflow }>()
const deployed = workflow.execution === 'deployment-demo'
const metadata = workflowMetadata(workflow)
const graph = workflowGraphSchema.parse(demoGraph)
const phase = ref<DemoPhase>('signed-out')
const section = ref('playground')
const graphPanel = useTemplateRef('graphPanel')
const resultVideo = useTemplateRef('resultVideo')
const playing = ref(false)
const playbackError = ref('')
const authOpen = ref(false)
const copyOpen = ref(false)
const copied = ref(false)
const selectedFile = ref('')
const removalPrompt = ref('Remove the crystal glass from the foreground.')
const previewUrl = ref('')
const fileError = ref('')
const busy = computed(() =>
  ['Starting server', 'Loading models', 'Generating'].includes(phase.value)
)
const stepIndex = computed(() =>
  demoSteps.findIndex((step) => step === phase.value)
)
const status = computed(() =>
  phase.value === 'cancelled'
    ? 'Run cancelled. You can try again.'
    : busy.value || phase.value === 'Ready'
      ? phase.value
      : 'Ready when you are'
)
const details = computed(
  () =>
    ({
      'Starting server':
        'Waking the GPU server for your workflow. The first run takes a little longer.',
      'Loading models':
        'Preparing LTX-2.3, the object-removal LoRA, and custom nodes.',
      Generating: 'Removing the object and filling the scene across frames.',
      Ready: 'Your sample result is ready to preview.'
    })[
      phase.value === 'Starting server' ||
      phase.value === 'Loading models' ||
      phase.value === 'Generating' ||
      phase.value === 'Ready'
        ? phase.value
        : 'Ready'
    ]
)
let timer: ReturnType<typeof setTimeout> | undefined
function dispatch(event: DemoEvent) {
  phase.value = transitionDemo(phase.value, event)
}
function stop(event: 'cancel' | 'sign-out') {
  clearTimeout(timer)
  dispatch(event)
}
function run() {
  if (busy.value || phase.value === 'signed-out') return
  resultVideo.value?.pause()
  if (resultVideo.value) resultVideo.value.currentTime = 0
  playing.value = false
  playbackError.value = ''
  dispatch('run')
  const advance = (delay: number, next?: () => void) => {
    timer = setTimeout(() => {
      dispatch('advance')
      next?.()
    }, delay)
  }
  advance(2000, () => advance(2500, () => advance(4000)))
}
function selectSection(value: string) {
  if (value !== 'playground') resultVideo.value?.pause()
  section.value = value
}
async function showGraph() {
  selectSection('workflow')
  await nextTick()
  graphPanel.value?.scrollIntoView({ block: 'start' })
}
async function playResult() {
  playbackError.value = ''
  try {
    await resultVideo.value?.play()
  } catch {
    playbackError.value = 'The video could not play. Press play to try again.'
  }
}
function openCopy() {
  copied.value = false
  copyOpen.value = true
}
function signIn() {
  dispatch('sign-in')
  authOpen.value = false
}
function chooseFile(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return
  const file = input.files[0]
  fileError.value = ''
  if (
    !file.type.startsWith(deployed ? 'video/' : 'image/') ||
    file.size > 100 * 1024 * 1024
  ) {
    fileError.value = `Choose ${deployed ? 'a video' : 'an image'} smaller than 100 MB.`
    input.value = ''
    return
  }
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)
  selectedFile.value = file.name
}
onScopeDispose(() => {
  clearTimeout(timer)
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <div class="mx-auto max-w-10xl px-6 pt-5 pb-20 lg:px-8">
    <WorkshopBrowseTabs active="workflows" />
    <a
      href="/models/workflows/"
      class="mb-7 inline-flex min-h-11 items-center gap-1 text-sm text-primary-warm-gray hover:text-primary-comfy-yellow"
      ><ChevronLeft class="size-4" /> All workflows</a
    >
    <header class="mb-8">
      <div
        class="mb-4 flex flex-wrap items-center gap-3 text-sm text-primary-warm-gray"
      >
        <span class="text-primary-comfy-yellow">{{ workflow.category }}</span>
        <span
          class="rounded-full border border-transparency-white-t20 px-3 py-1"
          >{{ deployed ? 'Comfy API deployment' : 'Workflow preview' }}</span
        >
        <span>Interactive demo</span>
      </div>
      <h1
        class="max-w-4xl text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
      >
        {{ workflow.title }}
      </h1>
      <p class="mt-4 max-w-3xl text-lg text-primary-warm-gray">
        {{ workflow.description }}
      </p>
      <div class="mt-4 flex flex-wrap gap-2 text-xs text-primary-warm-gray">
        <span
          v-for="model in metadata.models"
          :key="model"
          class="rounded-full bg-transparency-white-t8 px-3 py-2"
          >{{ model }}</span
        >
        <span
          v-if="deployed"
          class="rounded-full bg-transparency-white-t8 px-3 py-2"
          >Custom nodes</span
        >
      </div>
    </header>
    <WorkflowDetailTabs
      :model-value="section"
      @update:model-value="selectSection"
    />
    <WorkflowApiTab
      v-if="section === 'api'"
      :workflow
      :graph
      :values="{
        '39.file': selectedFile || 'input_playing_the_piano.mp4',
        '54:9.text': removalPrompt
      }"
    />
    <div
      v-if="section === 'workflow'"
      ref="graphPanel"
      class="scroll-mt-28 space-y-6"
    >
      <WorkflowGraph :template="workflow.template" />
      <a
        :href="`/workflows/graphs/${workflow.template}.json`"
        :download="`${workflow.template}.json`"
        class="inline-flex min-h-11 items-center text-sm text-primary-comfy-yellow"
        >Download workflow JSON</a
      >
    </div>
    <div
      v-show="section === 'playground'"
      class="mb-6 flex items-center justify-between gap-4 border-b border-transparency-white-t8 pb-4 text-sm text-primary-warm-gray"
    >
      <span>Demo mode · No uploads, charges, or live generation</span>
      <button
        v-if="phase !== 'signed-out'"
        class="min-h-11 shrink-0 hover:text-primary-comfy-yellow"
        @click="stop('sign-out')"
      >
        Demo account · Sign out
      </button>
    </div>
    <div
      v-show="section === 'playground'"
      class="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
    >
      <form
        class="rounded-3xl border border-transparency-white-t20 p-6"
        @submit.prevent="run"
      >
        <h2 class="mb-2 text-lg font-medium text-primary-comfy-canvas">
          Make it yours
        </h2>
        <p class="mb-5 text-sm text-primary-warm-gray">
          Start with the sample {{ deployed ? 'clip' : 'image' }} or preview
          your own input.
        </p>
        <fieldset :disabled="busy" class="space-y-5">
          <legend class="sr-only">Workflow inputs</legend>
          <div class="overflow-hidden rounded-2xl bg-hub-surface">
            <video
              v-if="deployed"
              :src="
                previewUrl ||
                templateAsset('input', 'input_playing_the_piano.mp4')
              "
              controls
              preload="metadata"
              aria-label="Input video"
              class="aspect-video w-full object-cover"
            />
            <img
              v-else
              :src="previewUrl || metadata.thumbnail"
              alt="Sample input"
              class="aspect-video w-full object-contain"
            />
          </div>
          <label class="block text-sm text-primary-warm-white"
            >{{ deployed ? 'Your footage' : 'Your image' }}
            <input
              type="file"
              :accept="deployed ? 'video/*' : 'image/*'"
              class="mt-2 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-transparency-white-t8 file:px-4 file:py-3 file:text-primary-warm-white"
              @change="chooseFile"
            />
          </label>
          <p
            v-if="fileError"
            role="alert"
            class="text-sm text-primary-warm-white"
          >
            {{ fileError }}
          </p>
          <p v-if="selectedFile" class="text-xs text-primary-warm-gray">
            {{ selectedFile }} stays in this browser. The demo always returns
            the sample result.
          </p>
          <label v-if="deployed" class="block text-sm text-primary-warm-white"
            >What should be removed?
            <textarea
              v-model="removalPrompt"
              rows="3"
              class="mt-2 w-full rounded-xl border border-transparency-white-t20 bg-page p-4"
            />
          </label>
        </fieldset>
        <div class="mt-6 space-y-3">
          <Button
            v-if="phase === 'signed-out'"
            type="button"
            class="w-full"
            @click="authOpen = true"
            >Sign in to run</Button
          >
          <Button v-else type="submit" :disabled="busy" class="w-full">{{
            busy ? status : 'Run workflow'
          }}</Button>
          <Button
            v-if="deployed"
            type="button"
            variant="outline"
            class="w-full"
            :prepend-icon="Copy"
            @click="openCopy"
            >Copy to Comfy API</Button
          >
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-center gap-2 text-sm text-primary-comfy-yellow hover:underline"
            @click="showGraph"
          >
            <Workflow class="size-4" />View node graph
          </button>
          <p class="text-center text-xs/relaxed text-primary-warm-gray">
            {{
              deployed
                ? 'Make this deployment your own, including its model and custom nodes.'
                : 'A simulated run to preview the generation experience.'
            }}
          </p>
        </div>
        <details
          v-if="deployed"
          class="mt-6 border-t border-transparency-white-t8 pt-4 text-sm text-primary-warm-gray"
        >
          <summary class="min-h-11 cursor-pointer text-primary-warm-white">
            Inside this deployment
          </summary>
          <p class="mt-2 leading-relaxed">
            LTX-2.3 and the object-removal LoRA rebuild the scene without the
            selected object. The candidate deployment includes ComfyUI-LTXVideo,
            comfyui-kjnodes, and comfyui-videohelpersuite.
          </p>
        </details>
      </form>
      <section
        aria-label="Generation result"
        class="overflow-hidden rounded-3xl border border-transparency-white-t20 lg:sticky lg:top-24"
      >
        <div
          class="flex items-center justify-between border-b border-transparency-white-t8 px-6 py-4"
        >
          <h2 class="font-medium text-primary-warm-white">
            {{ phase === 'Ready' ? 'Your result' : 'Result' }}
          </h2>
          <span class="text-xs text-primary-warm-gray">{{
            busy
              ? 'In progress'
              : phase === 'Ready'
                ? 'Demo result'
                : 'Example preview'
          }}</span>
        </div>
        <div
          :class="
            cn(
              'relative flex aspect-video items-center justify-center bg-hub-surface',
              busy && 'min-h-72'
            )
          "
          aria-label="Output preview"
        >
          <video
            v-if="deployed"
            v-show="!busy"
            ref="resultVideo"
            :src="demoVideo"
            :controls="!busy"
            playsinline
            preload="metadata"
            :aria-label="
              phase === 'Ready' ? 'Sample result video' : 'Example result video'
            "
            class="size-full object-contain"
            @play="playing = true"
            @pause="playing = false"
            @ended="playing = false"
          />
          <img
            v-else-if="!busy"
            :src="metadata.thumbnail"
            :alt="`Example: ${workflow.title}`"
            class="size-full object-contain"
          />
          <button
            v-if="deployed && !busy && !playing"
            type="button"
            :aria-label="
              phase === 'Ready' ? 'Play result video' : 'Play example video'
            "
            class="absolute flex size-16 items-center justify-center rounded-full bg-primary-comfy-yellow text-primary-comfy-ink shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-comfy-yellow"
            @click="playResult"
          >
            <Play class="ml-1 size-7 fill-current" />
          </button>
          <div
            v-if="busy"
            class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-hub-surface p-6 text-center text-primary-warm-white"
          >
            <Server
              v-if="phase === 'Starting server'"
              class="size-8 motion-safe:animate-pulse"
            /><Workflow v-else class="size-8 motion-safe:animate-pulse" />
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              class="space-y-2"
            >
              <p class="text-xl">{{ status }}</p>
              <p class="max-w-sm text-sm text-primary-warm-gray">
                {{ details }}
              </p>
            </div>
            <ol
              aria-label="Generation progress"
              class="grid w-full max-w-md grid-cols-4 gap-3"
            >
              <li
                v-for="(step, index) in demoSteps"
                :key="step"
                :aria-current="stepIndex === index ? 'step' : undefined"
                :class="
                  cn(
                    'border-t-2 pt-3 text-xs',
                    index <= stepIndex
                      ? 'border-primary-comfy-yellow text-primary-warm-white'
                      : 'border-transparency-white-t20 text-primary-warm-gray'
                  )
                "
              >
                {{ index < stepIndex ? '✓ ' : '' }}{{ step }}
              </li>
            </ol>
          </div>
        </div>
        <div class="space-y-4 p-6">
          <p
            v-if="playbackError"
            role="alert"
            class="text-sm text-primary-warm-white"
          >
            {{ playbackError }}
          </p>
          <div
            v-if="!busy"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            class="flex items-center gap-2 text-sm text-primary-warm-white"
          >
            <Check
              v-if="phase === 'Ready'"
              class="size-4 text-primary-comfy-yellow"
            />{{ status }}
          </div>

          <Button
            v-if="busy"
            variant="outline"
            type="button"
            @click="stop('cancel')"
            >Cancel run</Button
          >
          <p class="text-sm/relaxed text-primary-warm-gray">
            {{
              phase === 'Ready'
                ? 'Official template comparison: original on top, object removed below. This prerecorded sample did not process your input or prompt.'
                : 'Run this demo to preview server startup, generation, and the finished result.'
            }}
          </p>
          <a
            v-if="deployed && phase === 'Ready'"
            :href="demoVideo"
            download="object-removal-sample.mp4"
            class="inline-flex min-h-11 items-center text-sm text-primary-comfy-yellow"
            >Download sample video</a
          >
        </div>
      </section>
    </div>
    <Dialog v-model:open="authOpen">
      <DialogContent close-label="Close sign in">
        <DialogTitle class="pr-10 text-2xl text-primary-warm-white"
          >Sign in to Comfy</DialogTitle
        >
        <DialogDescription class="mt-4 text-sm/relaxed text-primary-warm-gray"
          >Save your workflows and run them with your Comfy account. For this
          prototype, continue with a demo account. No credentials are
          needed.</DialogDescription
        >
        <Button class="mt-6 w-full" @click="signIn"
          >Continue with demo account</Button
        >
      </DialogContent>
    </Dialog>
    <Dialog v-model:open="copyOpen">
      <DialogContent close-label="Close API copy">
        <DialogTitle class="pr-10 text-2xl text-primary-warm-white">{{
          copied ? 'Demo copy ready' : 'Copy to Comfy API'
        }}</DialogTitle>
        <DialogDescription
          class="mt-4 text-sm/relaxed text-primary-warm-gray"
          >{{
            copied
              ? 'This previews the handoff to your own deployment. No deployment was created.'
              : 'Copy this workflow, LTX-2.3, its object-removal LoRA, and custom nodes to your Comfy API workspace. You can then change the workflow and deploy your own endpoint.'
          }}</DialogDescription
        >
        <p
          class="mt-4 rounded-xl bg-transparency-white-t8 p-4 text-sm text-primary-warm-white"
        >
          Personal workspace · Demo
        </p>
        <Button v-if="!copied" class="mt-6 w-full" @click="copied = true"
          >Preview copy</Button
        >
        <Button v-else class="mt-6 w-full" @click="copyOpen = false"
          >Done</Button
        >
      </DialogContent>
    </Dialog>
  </div>
</template>
