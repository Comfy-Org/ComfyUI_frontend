import { Lamp, Moon, Sun } from '@lucide/vue'
import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'
import { computed, onUnmounted, ref, shallowRef } from 'vue'

import { LOCALES } from '@/config/locales'
import { translationsFor } from '@/i18n/translations'
import { imageSize } from '@/lib/workshop/image-size'
import { mockJob } from '@/lib/workshop/mock-job'
import AppEditorShell from './AppEditorShell.vue'
import EditorAlert from './EditorAlert.vue'
import EditorBusy from './EditorBusy.vue'
import EditorCollapsible from './EditorCollapsible.vue'
import EditorEmpty from './EditorEmpty.vue'
import EditorFrame from './EditorFrame.vue'
import EditorHint from './EditorHint.vue'
import EditorHistory from './EditorHistory.vue'
import EditorResult from './EditorResult.vue'
import EditorResultDock from './EditorResultDock.vue'
import EditorRun from './EditorRun.vue'
import EditorSeedField from './EditorSeedField.vue'
import EditorSegmented from './EditorSegmented.vue'
import EditorSwitch from './EditorSwitch.vue'
import EditorTool from './EditorTool.vue'
import type { EditorView } from './view'

interface Source {
  readonly url: string
  readonly width: number
  readonly height: number
}

type Stage =
  | { readonly kind: 'empty' }
  | {
      readonly kind: 'editing'
      readonly source: Source
      readonly notice?: string
    }
  | {
      readonly kind: 'running'
      readonly source: Source
      readonly job: AbortController
    }
  | {
      readonly kind: 'result'
      readonly source: Source
      readonly result: string
    }

type Start = 'empty' | 'editing' | 'result'

const EXAMPLE: Source = {
  url: '/images/cinematic-studio/options/light-golden.jpg',
  width: 1280,
  height: 720
}
const RESULT = '/images/cinematic-studio/options/light-night.jpg'
const RUN_MS = 3000

const LIGHTS = [
  { id: 'golden', label: 'Golden' },
  { id: 'night', label: 'Night' },
  { id: 'overcast', label: 'Overcast' }
] as const

function initialStage(start: Start): Stage {
  if (start === 'empty') return { kind: 'empty' }
  if (start === 'result')
    return { kind: 'result', source: EXAMPLE, result: RESULT }
  return { kind: 'editing', source: EXAMPLE }
}

/**
 * The full-screen editor every Workshop app is built in: the stage in the
 * middle, a header with the download, the dock of tools at the bottom and the
 * floating side panel on the left. Below 768px the panel becomes a bottom
 * sheet with its `panel-peek` slot as the collapsed summary. The stage zooms
 * with ctrl or pinch wheel and the + - 0 keys once an `EditorFrame` is on it.
 *
 * This demo runs the whole loop against a mock job: upload or pick the
 * example, Generate, cancel or wait for the result, then compare.
 */
const meta: Meta<
  ComponentPropsAndSlots<typeof AppEditorShell> & { start: Start }
> = {
  title: 'Website/Workshop/AppEditor/AppEditorShell',
  component: AppEditorShell,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Example app',
    toolsLabel: 'Tools',
    panelLabels: {
      label: 'Light settings',
      expand: 'Show settings',
      collapse: 'Hide settings'
    },
    locale: 'en',
    start: 'editing'
  },
  argTypes: {
    locale: { control: 'select', options: Object.keys(LOCALES) },
    start: { control: 'inline-radio', options: ['empty', 'editing', 'result'] }
  },
  render: (args) => ({
    components: {
      AppEditorShell,
      EditorAlert,
      EditorBusy,
      EditorCollapsible,
      EditorEmpty,
      EditorFrame,
      EditorHint,
      EditorHistory,
      EditorResult,
      EditorResultDock,
      EditorRun,
      EditorSeedField,
      EditorSegmented,
      EditorSwitch,
      EditorTool
    },
    setup() {
      const { t } = translationsFor(args.locale ?? 'en')
      const stage = shallowRef<Stage>(initialStage(args.start))
      const view = ref<EditorView>('compare')
      const light = ref<(typeof LIGHTS)[number]['id']>('night')
      const keepFace = ref(true)
      const seed = ref(421_337)
      const tool = ref<'sun' | 'moon'>('moon')
      const edits = ref(1)
      const undone = ref(0)

      const source = computed(() =>
        stage.value.kind === 'empty' ? undefined : stage.value.source
      )
      const download = computed(() =>
        stage.value.kind === 'result'
          ? { href: stage.value.result, name: 'relit.jpg' }
          : undefined
      )

      const objectUrls = new Set<string>()
      onUnmounted(() => {
        for (const url of objectUrls) URL.revokeObjectURL(url)
        objectUrls.clear()
      })

      function release(url: string | undefined) {
        if (url && objectUrls.delete(url)) URL.revokeObjectURL(url)
      }

      function show(url: string, size: Awaited<ReturnType<typeof imageSize>>) {
        release(source.value?.url)
        if (size) {
          stage.value = { kind: 'editing', source: { url, ...size } }
          return
        }
        release(url)
        stage.value = {
          kind: 'editing',
          source: EXAMPLE,
          notice: 'That file is not an image we can read.'
        }
      }

      async function open(file: File) {
        const url = URL.createObjectURL(file)
        objectUrls.add(url)
        const size = await imageSize(url)
        if (objectUrls.has(url)) show(url, size)
      }

      async function run() {
        const current = source.value
        if (!current) return
        const job = new AbortController()
        stage.value = { kind: 'running', source: current, job }
        try {
          const result = await mockJob(RESULT, job.signal, RUN_MS)
          stage.value = { kind: 'result', source: current, result }
          view.value = 'compare'
        } catch {
          stage.value = {
            kind: 'editing',
            source: current,
            notice: t('cinematic.state.cancelled')
          }
        }
      }

      function cancel() {
        if (stage.value.kind === 'running') stage.value.job.abort()
      }

      function edit() {
        if (source.value)
          stage.value = { kind: 'editing', source: source.value }
      }

      return {
        args,
        t,
        stage,
        source,
        download,
        view,
        light,
        keepFace,
        seed,
        tool,
        edits,
        undone,
        open,
        run,
        cancel,
        edit,
        LIGHTS,
        EXAMPLE,
        Sun,
        Moon,
        Lamp
      }
    },
    template: `
        <AppEditorShell
          :title="args.title"
          :tools-label="args.toolsLabel"
          :panel-labels="args.panelLabels"
          :panel-dimmed="stage.kind === 'running'"
          :show-dock="stage.kind !== 'empty'"
          :download
          :locale="args.locale"
        >
          <EditorEmpty
            v-if="stage.kind === 'empty'"
            title="Drop a photo to start"
            meta="PNG, JPG or WebP, up to 20 MB"
            upload-label="Upload a photo"
            example-label="Try the pier"
            :example-image="EXAMPLE.url"
            @file="open"
            @example="stage = { kind: 'editing', source: EXAMPLE }"
          />
          <EditorResult
            v-else-if="stage.kind === 'result'"
            :before="stage.source.url"
            :after="stage.result"
            :view
            :width="stage.source.width"
            :height="stage.source.height"
            :labels="{
              resultAlt: 'The photo relit',
              originalAlt: 'The original photo',
              original: 'Original',
              result: 'Result',
              slider: 'Drag to compare'
            }"
          />
          <EditorFrame v-else-if="source" :width="source.width" :height="source.height">
            <img :src="source.url" alt="The photo to edit" class="size-full rounded-sm object-cover" />
            <EditorBusy
              v-if="stage.kind === 'running'"
              :title="t('cinematic.stage.generatingImage')"
              detail="About 3 seconds"
              :cancel-label="t('cinematic.output.cancel')"
              @cancel="cancel"
            />
            <EditorHint v-else text="Drag on the photo to place the light" />
          </EditorFrame>

          <template #tray>
            <EditorAlert v-if="stage.kind === 'editing' && stage.notice">{{ stage.notice }}</EditorAlert>
          </template>
          <template #dock>
            <EditorResultDock
              v-if="stage.kind === 'result'"
              v-model:view="view"
              :labels="{
                compare: t('cinematic.compare.label'),
                result: 'Result',
                original: 'Original',
                edit: t('cinematic.state.editScene'),
                again: t('cinematic.stage.again')
              }"
              @edit="edit"
              @again="run"
            />
            <template v-else>
              <EditorTool :icon="Sun" label="Sunlight" :pressed="tool === 'sun'" @click="tool = 'sun'" />
              <EditorTool :icon="Moon" label="Moonlight" :pressed="tool === 'moon'" @click="tool = 'moon'" />
            </template>
          </template>
          <template #history>
            <EditorHistory
              v-if="stage.kind !== 'result'"
              :can-undo="edits > 0"
              :can-redo="undone > 0"
              :disabled="stage.kind === 'running'"
              :labels="{ group: 'History', undo: 'Undo', redo: 'Redo' }"
              @undo="edits--; undone++"
              @redo="undone--; edits++"
            />
          </template>

          <template #panel>
            <EditorCollapsible title="Light" initially-open>
              <EditorSegmented v-model="light" label="Time of day" :options="LIGHTS" fill />
              <EditorSwitch v-model="keepFace" label="Keep the face" />
            </EditorCollapsible>
            <EditorCollapsible title="Advanced">
              <EditorSeedField v-model="seed" label="Seed" shuffle-label="Shuffle seed" />
            </EditorCollapsible>
          </template>
          <template #panel-peek>
            <Lamp class="size-4 text-primary-warm-gray" aria-hidden="true" />
            <span class="flex-1 truncate text-xs text-primary-warm-white">{{ LIGHTS.find((option) => option.id === light)?.label }}</span>
          </template>
          <template #panel-footer>
            <EditorRun
              :label="t('cinematic.output.generate')"
              credits="~4 credits"
              :cancel-label="t('cinematic.output.cancel')"
              :running="stage.kind === 'running'"
              :disabled="stage.kind === 'empty'"
              block
              @run="run"
              @cancel="cancel"
            />
          </template>
        </AppEditorShell>
      `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Editing: Story = {}

/** Before anything is picked: no dock, and Generate waits for a photo. */
export const Empty: Story = { args: { start: 'empty' } }

/** A finished run: the result dock, the compare split and the download. */
export const Result: Story = { args: { start: 'result' } }
