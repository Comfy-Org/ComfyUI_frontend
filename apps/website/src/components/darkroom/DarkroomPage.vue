<script setup lang="ts">
import { useEventListener, useInfiniteScroll } from '@vueuse/core'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'

import WorkshopGate from '@/components/workshop/WorkshopGate.vue'
import type { DarkroomNotice } from '@/composables/useDarkroom'
import { useDarkroom } from '@/composables/useDarkroom'
import type { DarkroomJob, DarkroomReference } from '@/lib/darkroom/feed'
import {
  doneSlots,
  isDone,
  isPending,
  promptHistory
} from '@/lib/darkroom/feed'
import { fileToInput } from '@/lib/darkroom/moodboard'
import type { DarkroomDraft, DarkroomRequest } from '@/lib/darkroom/request'
import { draftFromSettings, settingsFromRequest } from '@/lib/darkroom/request'
import type { DarkroomItem } from '@/lib/darkroom/store'
import type { DarkroomSettings, DarkroomView } from '@/lib/darkroom/vocabulary'
import {
  DARKROOM_SHAPES,
  darkroomModelName,
  darkroomView,
  DEFAULT_DARKROOM_SETTINGS,
  restoreDarkroomSettings
} from '@/lib/darkroom/vocabulary'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

import DarkroomBoardMenu from './DarkroomBoardMenu.vue'
import DarkroomHeader from './DarkroomHeader.vue'
import DarkroomJobRow from './DarkroomJobRow.vue'
import DarkroomLightbox from './DarkroomLightbox.vue'
import DarkroomMoodboards from './DarkroomMoodboards.vue'
import DarkroomOrganize from './DarkroomOrganize.vue'
import DarkroomPromptBar from './DarkroomPromptBar.vue'
import DarkroomSettingsPanel from './DarkroomSettingsPanel.vue'
import DarkroomTabs from './DarkroomTabs.vue'
import DarkroomToast from './DarkroomToast.vue'
import DarkroomWelcome from './DarkroomWelcome.vue'

const SETTINGS_KEY = 'comfy.darkroom.settings'
const BOARD_KEY = 'comfy.darkroom.moodboard'
const NOTIFY_KEY = 'comfy.darkroom.notify-asked'
const FEED_PAGE = 24

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

// ---------- notices ----------

interface Toast {
  readonly message: string
  readonly undo?: () => void
}
const toast = shallowRef<Toast>()
let toastTimer: ReturnType<typeof setTimeout> | undefined

function say(message: string, undo?: () => void) {
  toast.value = { message, undo }
  clearTimeout(toastTimer)
  // A notice with Undo stays up longer.
  toastTimer = setTimeout(() => (toast.value = undefined), undo ? 8000 : 2800)
}

function notify(notice: DarkroomNotice) {
  const count = notice.values?.count
  say(
    typeof count === 'number'
      ? t(`darkroom.toast.${notice.key}`, notice.values ?? {}, count)
      : t(`darkroom.toast.${notice.key}`, notice.values ?? {}),
    notice.undo
  )
}

function undo() {
  const action = toast.value?.undo
  toast.value = undefined
  action?.()
}

const darkroom = useDarkroom(notify)
const { jobs, boards, urls, gate } = darkroom

// ---------- settings ----------

const settings = ref<DarkroomSettings>({ ...DEFAULT_DARKROOM_SETTINGS })
const activeBoardId = ref<string | null>(null)
const prompt = ref('')
const references = shallowRef<DarkroomReference[]>([])
const settingsOpen = ref(false)
const bar = useTemplateRef<{ focus: () => void }>('bar')
let restored = false

function stored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function store(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    /* storage may be unavailable; the choice just does not persist */
  }
}

onMounted(() => {
  try {
    settings.value = restoreDarkroomSettings(
      JSON.parse(stored(SETTINGS_KEY) ?? 'null')
    )
  } catch {
    /* unreadable settings fall back to the defaults */
  }
  activeBoardId.value = stored(BOARD_KEY)
  restored = true
  route()
})
watch(
  settings,
  (value) => restored && store(SETTINGS_KEY, JSON.stringify(value)),
  { deep: true }
)

const activeBoard = computed(() => darkroom.boardById(activeBoardId.value))
const runs = computed(() =>
  Math.min(settings.value.runs, Math.max(1, darkroom.maxRuns.value))
)
const summary = computed(() =>
  t(
    'darkroom.settings.summary',
    {
      model: darkroomModelName(settings.value.model),
      shape: t(
        `darkroom.shapes.${DARKROOM_SHAPES.find((shape) => shape.value === settings.value.shape)?.key ?? 'auto'}`
      ),
      count: runs.value
    },
    runs.value
  )
)

function setActiveBoard(id: string | undefined) {
  activeBoardId.value = id ?? null
  store(BOARD_KEY, id ?? null)
}

function resetSettings() {
  settings.value = { ...DEFAULT_DARKROOM_SETTINGS }
  say(t('darkroom.toast.settingsReset'))
}

function toggleSettings(open = !settingsOpen.value) {
  settingsOpen.value = open
  if (open) window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ---------- views ----------

const view = ref<DarkroomView>('create')
const boardOpen = ref<string>()
const moodboards = useTemplateRef<{ focusName: () => void }>('moodboards')

function route() {
  const [name, id] = (window.location.hash.slice(1) || 'create').split('/')
  view.value = darkroomView(name)
  boardOpen.value = view.value === 'moodboards' && id ? id : undefined
}

function go(target: string) {
  if (window.location.hash.slice(1) !== target) window.location.hash = target
  else route()
  window.scrollTo(0, 0)
}

useEventListener('hashchange', route)

// A board that no longer exists falls back to the list.
watch([boardOpen, boards, darkroom.loaded], () => {
  if (
    boardOpen.value &&
    darkroom.loaded.value &&
    !darkroom.boardById(boardOpen.value)
  )
    go('moodboards')
})

// ---------- reference images ----------

async function addFiles(files: readonly File[], announce = false) {
  const images = files.filter((file) => file.type.startsWith('image/'))
  for (const file of images) {
    const input = await fileToInput(file)
    references.value = [...references.value, { ...input, name: file.name }]
    if (announce)
      say(t('darkroom.toast.addedReference', { n: references.value.length }))
  }
}

function takeFiles(files: readonly File[]) {
  if (boardOpen.value) void darkroom.uploadToBoard(boardOpen.value, files)
  else void addFiles(files)
}

const signedIn = computed(
  () => gate.value !== 'signedOut' && gate.value !== 'pending'
)
const dragging = ref(false)
let dragDepth = 0

useEventListener('dragenter', (event: DragEvent) => {
  if (!signedIn.value || !event.dataTransfer?.types.includes('Files')) return
  dragDepth += 1
  dragging.value = true
})
useEventListener('dragleave', () => {
  dragDepth -= 1
  if (dragDepth <= 0) {
    dragDepth = 0
    dragging.value = false
  }
})
useEventListener('dragover', (event: DragEvent) => {
  if (dragging.value) event.preventDefault()
})
useEventListener('drop', (event: DragEvent) => {
  if (!dragging.value) return
  event.preventDefault()
  dragDepth = 0
  dragging.value = false
  takeFiles([...(event.dataTransfer?.files ?? [])])
})
useEventListener('paste', (event: ClipboardEvent) => {
  const files = [...(event.clipboardData?.files ?? [])]
  const target = event.target
  if (
    !signedIn.value ||
    !files.length ||
    (target instanceof Element && target.closest('input'))
  )
    return
  event.preventDefault()
  takeFiles(files)
})

// ---------- generate ----------

function askToNotify() {
  if (!('Notification' in window) || Notification.permission !== 'default')
    return
  if (stored(NOTIFY_KEY)) return
  store(NOTIFY_KEY, '1')
  void Notification.requestPermission().then((permission) => {
    if (permission === 'granted') say(t('darkroom.toast.notifyOn'))
  })
}

async function start(
  draft: DarkroomDraft,
  images: readonly DarkroomReference[],
  count: number,
  seed: string,
  boardId?: string | null
) {
  askToNotify()
  if (view.value !== 'create') go('create')
  window.scrollTo({ top: 0, behavior: 'smooth' })
  await darkroom.generate(draft, images, count, seed, boardId)
}

function generate() {
  const text = prompt.value.trim()
  if (gate.value !== 'ready') return
  if (darkroom.blocked.value) return say(t('darkroom.toast.blocked'))
  if (!text) {
    bar.value?.focus()
    return say(t('darkroom.toast.describeFirst'))
  }
  void start(
    draftFromSettings(settings.value, text),
    references.value,
    runs.value,
    settings.value.seed,
    activeBoardId.value
  )
}

function draftOf(request: DarkroomRequest): DarkroomDraft {
  return {
    prompt: request.prompt,
    model: request.model,
    aspectRatio: request.aspectRatio,
    imageSize: request.imageSize,
    mimeType: request.mimeType,
    temperature: request.temperature,
    ...(request.thinkingLevel ? { thinkingLevel: request.thinkingLevel } : {}),
    ...(request.system ? { system: request.system } : {})
  }
}

/** The same prompt and settings again, with new seeds. */
function rerun(job: DarkroomJob) {
  void start(
    draftOf(job.settings),
    job.references ?? [],
    job.slots.length,
    '',
    job.settings.moodboard?.id
  )
}

/** New images from this one: same prompt, this image as the reference. */
async function vary(item: DarkroomItem) {
  const reference = await darkroom.referenceFrom(item)
  if (!reference) return
  void start(
    draftOf(item.settings),
    [reference],
    runs.value,
    '',
    item.settings.moodboard?.id
  )
}

async function edit(item: DarkroomItem) {
  const reference = await darkroom.referenceFrom(item)
  if (!reference) return
  closeLightbox()
  references.value = [...references.value, reference]
  say(t('darkroom.toast.addedReference', { n: references.value.length }))
  if (view.value !== 'create') go('create')
  window.scrollTo({ top: 0, behavior: 'smooth' })
  bar.value?.focus()
}

/** Loads a past image's prompt, settings and seed back into the bar. */
function reuse(request: DarkroomRequest) {
  closeLightbox()
  prompt.value = request.prompt
  settings.value = settingsFromRequest(settings.value, request)
  if (view.value !== 'create') go('create')
  window.scrollTo({ top: 0, behavior: 'smooth' })
  say(t('darkroom.toast.settingsLoaded'))
}

function useExample(example: string) {
  prompt.value = example
  bar.value?.focus()
}

// ---------- feed paging ----------

const feedLimit = ref(FEED_PAGE)
const shownJobs = computed(() => jobs.value.slice(0, feedLimit.value))
useInfiniteScroll(
  () => (typeof window === 'undefined' ? null : window),
  () => {
    if (view.value === 'create' && feedLimit.value < jobs.value.length)
      feedLimit.value += FEED_PAGE
  },
  { distance: 1500 }
)

// ---------- moodboard menu ----------

interface Menu {
  readonly anchor: HTMLElement
  readonly mode: 'add' | 'use'
  readonly pick: (id: string | undefined, newName?: string) => void
}
const menu = shallowRef<Menu>()
const covers = computed(
  () =>
    new Map(
      boards.value.flatMap((board) => {
        const url = urls.get(darkroom.boardItems(board)[0])
        return url ? [[board.id, url] as const] : []
      })
    )
)

function openMenu(next: Menu) {
  menu.value = menu.value?.anchor === next.anchor ? undefined : next
}

function pickBoardFor(
  items: readonly string[],
  anchor: HTMLElement,
  done?: () => void
) {
  openMenu({
    anchor,
    mode: 'add',
    pick: (id, newName) => {
      menu.value = undefined
      void darkroom.addToBoard(items, id, newName).then(done)
    }
  })
}

function pickActiveBoard(anchor: HTMLElement) {
  openMenu({
    anchor,
    mode: 'use',
    pick: (id) => {
      menu.value = undefined
      setActiveBoard(id)
      const board = darkroom.boardById(id)
      if (board) say(t('darkroom.toast.following', { name: board.name }))
    }
  })
}

async function createBoard() {
  const board = await darkroom.createBoard(t('darkroom.boards.newName'))
  go(`moodboards/${board.id}`)
  moodboards.value?.focusName()
}

function useBoard(id: string | undefined) {
  setActiveBoard(id)
  const board = darkroom.boardById(id)
  if (!board) return
  go('create')
  bar.value?.focus()
  say(t('darkroom.toast.followingDescribe', { name: board.name }))
}

async function removeBoard(id: string) {
  await darkroom.deleteBoard(id)
  if (activeBoardId.value === id) setActiveBoard(undefined)
  go('moodboards')
}

// ---------- viewer ----------

const viewing = ref<string>()
const viewable = computed(() => doneSlots(jobs.value).map((slot) => slot.item))
const viewIndex = computed(() =>
  viewable.value.findIndex((item) => item.id === viewing.value)
)
const viewed = computed(() => viewable.value[viewIndex.value])

function closeLightbox() {
  viewing.value = undefined
}

function step(direction: -1 | 1) {
  const next = viewable.value[viewIndex.value + direction]
  if (next) viewing.value = next.id
}

async function copyPrompt(item: DarkroomItem) {
  try {
    await navigator.clipboard.writeText(item.settings.prompt)
    say(t('darkroom.toast.copied'))
  } catch {
    say(t('darkroom.toast.copyFailed'))
  }
}

// ---------- while you wait ----------

// The tab title counts images in progress, and a row that finishes while the
// tab is in the background says so with a system notification.
const busyRows = new Set<string>()
watch(
  jobs,
  (rows) => {
    const base = t('darkroom.meta.title')
    const live = darkroom.developing.value
    document.title = live ? `(${live}) ${base}` : base
    for (const job of rows) {
      const busy = job.slots.some(isPending)
      if (!busy && busyRows.delete(job.jobId)) announce(job)
      if (busy) busyRows.add(job.jobId)
    }
  },
  { flush: 'post' }
)

function announce(job: DarkroomJob) {
  if (
    !document.hidden ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  )
    return
  const done = job.slots.filter(isDone)
  const failed = job.slots.filter(
    (slot) => slot.status === 'error' && !slot.cancelled
  ).length
  if (!done.length && !failed) return
  const words = job.settings.prompt
  const notification = new Notification(
    done.length
      ? t('darkroom.notify.ready', { count: done.length }, done.length)
      : t('darkroom.notify.failed'),
    {
      body: words.length > 90 ? `${words.slice(0, 88)}…` : words,
      tag: job.jobId
    }
  )
  notification.onclick = () => {
    window.focus()
    if (view.value !== 'create') go('create')
    notification.close()
  }
}

onBeforeUnmount(() => clearTimeout(toastTimer))

// ---------- what the template shows ----------

const signedOut = computed(() => gate.value === 'signedOut')
// The welcome screen waits for the feed to load, so it never flashes before
// an account's images appear.
const showWelcome = computed(
  () => !jobs.value.length && (darkroom.loaded.value || !signedIn.value)
)
const notice = computed(() => {
  if (darkroom.blocked.value) return t('darkroom.toast.blocked')
  return darkroom.storageFailed.value ? t('darkroom.storageFailed') : ''
})
const dropHint = computed(() =>
  boardOpen.value
    ? t('darkroom.prompt.dropBoard')
    : t('darkroom.prompt.dropReferences')
)

function removeReference(index: number) {
  references.value = references.value.filter((_, at) => at !== index)
}

function showItem(item: DarkroomItem) {
  viewing.value = item.id
}

function toggleStar(item: DarkroomItem) {
  void darkroom.setStarred([item.id], !item.starred)
}

function boardForItem(item: DarkroomItem, anchor: HTMLElement) {
  pickBoardFor([item.id], anchor)
}

function showBoard(id?: string) {
  go(id ? `moodboards/${id}` : 'moodboards')
}

function manageBoards() {
  menu.value = undefined
  go('moodboards')
}

function varyViewed(item: DarkroomItem) {
  closeLightbox()
  void vary(item)
}
</script>

<template>
  <WorkshopGate>
    <template #loading>
      <div class="min-h-[60vh]" />
    </template>
    <template #fallback>
      <div
        class="mx-auto max-w-xl px-4 py-24 text-center text-base/relaxed text-content-muted"
        data-testid="darkroom-unavailable"
      >
        <h1 class="mb-2 text-base font-semibold text-primary-warm-white">
          {{ t('darkroom.unavailable.title') }}
        </h1>
        {{ t('darkroom.unavailable.body') }}
      </div>
    </template>

    <div class="min-h-[80vh] text-content" data-testid="darkroom">
      <DarkroomHeader :locale />
      <DarkroomPromptBar
        ref="bar"
        v-model="prompt"
        :gate
        :references
        :history="promptHistory(jobs)"
        :board-name="activeBoard?.name"
        :summary
        :settings-open="settingsOpen"
        :locale
        @generate="generate"
        @files="addFiles"
        @remove-reference="removeReference"
        @clear-references="references = []"
        @toggle-settings="toggleSettings()"
        @moodboard="pickActiveBoard"
      >
        <template #tabs>
          <DarkroomTabs :view :locale @show="go" />
        </template>
      </DarkroomPromptBar>

      <DarkroomSettingsPanel
        v-if="settingsOpen"
        v-model="settings"
        :max-runs="darkroom.maxRuns.value"
        :locale
        @close="toggleSettings(false)"
        @reset="resetSettings"
      />

      <p
        v-if="notice"
        role="status"
        class="mx-auto mt-4 w-full max-w-10xl px-4 text-sm text-content-muted sm:px-8 lg:px-14"
      >
        {{ notice }}
      </p>

      <div v-show="view === 'create'">
        <DarkroomWelcome
          v-if="showWelcome"
          :signed-out="signedOut"
          :locale
          @example="useExample"
        />
        <div
          class="mx-auto flex w-full max-w-10xl flex-col gap-9 px-4 py-6 sm:px-8 lg:px-14"
          data-testid="darkroom-feed"
        >
          <DarkroomJobRow
            v-for="job in shownJobs"
            :key="job.jobId"
            :job
            :urls
            :can-retry="darkroom.canRetry"
            :locale
            @open="showItem"
            @cancel="darkroom.cancel"
            @retry="darkroom.retry"
            @star="toggleStar"
            @edit="edit"
            @vary="vary"
            @board="boardForItem"
            @rerun="rerun(job)"
            @reuse="reuse(job.settings)"
            @cancel-all="darkroom.cancelJob(job)"
            @remove="darkroom.deleteJob(job)"
          />
        </div>
      </div>

      <DarkroomOrganize
        v-if="view === 'organize'"
        :jobs
        :urls
        :locale
        @open="showItem"
        @board="pickBoardFor"
        @star="darkroom.setStarred"
        @remove="darkroom.deleteItems"
      />

      <DarkroomMoodboards
        v-if="view === 'moodboards'"
        ref="moodboards"
        :boards
        :open-id="boardOpen"
        :active-id="activeBoardId"
        :urls
        :items-of="darkroom.boardItems"
        :locale
        @show="showBoard"
        @create="createBoard"
        @rename="(id, name) => darkroom.updateBoard(id, { name })"
        @use="useBoard"
        @upload="darkroom.uploadToBoard"
        @remove="removeBoard"
        @drop="(id, item) => darkroom.updateBoard(id, { remove: [item] })"
      />

      <DarkroomBoardMenu
        v-if="menu"
        :key="menu.mode"
        :anchor="menu.anchor"
        :mode="menu.mode"
        :boards
        :items-of="darkroom.boardItems"
        :covers
        :active-id="activeBoardId"
        :locale
        @pick="menu.pick"
        @manage="manageBoards"
        @close="menu = undefined"
      />

      <DarkroomLightbox
        v-if="viewed"
        :item="viewed"
        :url="urls.get(viewed.id)"
        :has-previous="viewIndex > 0"
        :has-next="viewIndex < viewable.length - 1"
        :locale
        @close="closeLightbox"
        @step="step"
        @copy="copyPrompt(viewed)"
        @reuse="reuse(viewed.settings)"
        @star="toggleStar(viewed)"
        @edit="edit(viewed)"
        @vary="varyViewed(viewed)"
        @board="(anchor) => boardForItem(viewed, anchor)"
      />

      <div
        v-if="dragging"
        class="pointer-events-none fixed inset-0 z-40 flex items-center justify-center border-2 border-dashed border-transparency-white-t20 bg-primary-comfy-ink/90 text-2xl text-primary-warm-white"
      >
        {{ dropHint }}
      </div>

      <DarkroomToast
        :message="toast?.message"
        :undoable="toast?.undo !== undefined"
        :locale
        @undo="undo"
      />
    </div>
  </WorkshopGate>
</template>
