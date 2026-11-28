<script setup lang="ts">
import {
  computed,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  useId
} from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'
import Button from '@comfyorg/design-system/button/Button'
import Dialog from '@comfyorg/design-system/dialog/Dialog'
import DialogContent from '@comfyorg/design-system/dialog/DialogContent'
import DialogFooter from '@comfyorg/design-system/dialog/DialogFooter'
import DialogHeader from '@comfyorg/design-system/dialog/DialogHeader'
import DialogOverlay from '@comfyorg/design-system/dialog/DialogOverlay'
import DialogPortal from '@comfyorg/design-system/dialog/DialogPortal'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import type {
  PathCompletion,
  PathSuggestion,
  PathSuggestions,
  WidgetAugmentationTarget
} from '@/platform/extensions/widgetAugmentation'
import { useTextareaEdit } from '@/renderer/extensions/textEditor/useTextareaEdit'

const { provider, widget, initialValue, label, maxlength } = defineProps<{
  provider: PathCompletion
  widget: WidgetAugmentationTarget
  initialValue: string
  label: string
  maxlength?: number
}>()
const emit = defineEmits<{ confirm: [value: string]; close: [] }>()
const inputId = useId()
const listId = useId()
const input = ref<HTMLInputElement>()
const draft = ref(initialValue)
const showAllFiles = ref(false)
const active = ref(0)
const editError = ref('')
const lookup = shallowRef<PathSuggestions | { status: 'loading' | 'failed' }>({
  status: 'loading'
})
const items = computed(() =>
  lookup.value.status === 'ready' ? lookup.value.items : []
)
const lookupFailed = computed(() => lookup.value.status === 'failed')
const activeOptionId = computed(() =>
  items.value.length ? `${listId}-${active.value}` : undefined
)
const statusMessage = computed(() => {
  switch (lookup.value.status) {
    case 'loading':
      return 'g.loading'
    case 'ready':
      return items.value.length ? undefined : 'pathCompletion.empty'
    default:
      return 'pathCompletion.unavailable'
  }
})
const kindIcon = {
  directory: 'icon-[lucide--folder]',
  file: 'icon-[lucide--file]'
} as const satisfies Record<PathSuggestion['kind'], string>
let request: AbortController | undefined
let composing = false
const edit = useTextareaEdit(
  () => input.value,
  () => !composing
)

function invalidate() {
  request?.abort()
  request = undefined
}
onScopeDispose(invalidate)

function fail(error: unknown) {
  invalidate()
  lookup.value = { status: 'failed' }
  reportError(error, {
    errorType: 'error_evaluating_widget_augmentation',
    surface: 'platform',
    context: { augmentation: provider.id }
  })
}

function validResult(value: unknown): value is PathSuggestions {
  if (typeof value !== 'object' || value === null || !('status' in value))
    return false
  if (value.status === 'unavailable') return true
  return (
    value.status === 'ready' &&
    'items' in value &&
    Array.isArray(value.items) &&
    value.items.every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        'label' in item &&
        typeof item.label === 'string' &&
        'value' in item &&
        typeof item.value === 'string' &&
        'kind' in item &&
        (item.kind === 'file' || item.kind === 'directory')
    )
  )
}

async function refresh() {
  invalidate()
  if (composing || lookup.value.status === 'failed') return
  const current = new AbortController()
  request = current
  lookup.value = { status: 'loading' }
  active.value = 0
  try {
    const result: unknown = await provider.suggest(draft.value, {
      signal: current.signal,
      showAllFiles: showAllFiles.value,
      widget
    })
    if (request !== current) return
    if (!validResult(result)) {
      fail(new Error('Invalid path-completion result'))
      return
    }
    lookup.value = result
  } catch (error) {
    if (request === current) fail(error)
  }
}
onMounted(refresh)

function changed() {
  if (input.value) draft.value = input.value.value
  editError.value = ''
  void refresh()
}

function compositionStart() {
  composing = true
  invalidate()
  if (lookup.value.status !== 'failed') lookup.value = { status: 'loading' }
}

function compositionEnd() {
  composing = false
  changed()
}

function replace(value: string): boolean {
  const snapshot = edit.snapshot()
  if (!snapshot) return false
  if (snapshot.value === value) return true
  const result = edit.replace(
    snapshot,
    { from: 0, to: snapshot.value.length },
    value
  )
  if (!result.ok) {
    editError.value =
      result.reason === 'maxlength'
        ? 'textEditor.actionTooLong'
        : 'textEditor.actionUnavailable'
    return false
  }
  changed()
  return true
}

function confirm() {
  if (composing) return
  invalidate()
  emit('confirm', draft.value)
}

function select(item: PathSuggestion, accept: boolean) {
  if (replace(item.value) && accept && item.kind === 'file') confirm()
}

function parent() {
  if (composing || lookup.value.status === 'failed') return
  try {
    const value: unknown = provider.parent(draft.value)
    if (typeof value !== 'string') {
      fail(new Error('Invalid path-completion parent'))
      return
    }
    replace(value)
  } catch (error) {
    fail(error)
  }
}

function toggleFilter() {
  showAllFiles.value = !showAllFiles.value
  void refresh()
}

function moveActive(step: number): boolean {
  const count = items.value.length
  if (!count) return false
  active.value = (active.value + step + count) % count
  document
    .getElementById(activeOptionId.value ?? '')
    ?.scrollIntoView({ block: 'nearest' })
  return true
}

function completeActive(): boolean {
  const item = items.value[active.value]
  if (!item) return false
  select(item, false)
  return true
}

function showAll() {
  showAllFiles.value = true
  void refresh()
}

const keyCommands = new Map<string, () => boolean>([
  ['Enter', () => (confirm(), true)],
  ['Tab', completeActive],
  ['ArrowDown', () => moveActive(1)],
  ['ArrowUp', () => moveActive(-1)]
])

const ctrlCommands = new Map<string, () => void>([
  ['b', parent],
  ['g', showAll]
])

function runCtrlCommand(key: string): boolean {
  const command = ctrlCommands.get(key.toLowerCase())
  command?.()
  return command !== undefined
}

function keydown(event: KeyboardEvent) {
  if (composing || event.isComposing) return
  if (event.key === 'Tab' && event.shiftKey) return
  const handled =
    keyCommands.get(event.key)?.() ||
    (event.ctrlKey && runCtrlCommand(event.key))
  if (handled) event.preventDefault()
}
</script>

<template>
  <Dialog :open="true" @update:open="!$event && emit('close')">
    <DialogPortal>
      <DialogOverlay />
      <DialogContent size="md" :aria-describedby="undefined">
        <DialogHeader>
          <DialogTitle>{{ $t('pathCompletion.title') }}</DialogTitle>
        </DialogHeader>
        <div class="flex flex-col gap-3 px-4 py-2">
          <label :for="inputId">{{ label }}</label>
          <input
            :id="inputId"
            ref="input"
            :value="draft"
            autofocus
            :maxlength="maxlength"
            autocomplete="off"
            role="combobox"
            :aria-expanded="items.length > 0"
            :aria-controls="listId"
            :aria-activedescendant="activeOptionId"
            aria-autocomplete="list"
            class="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @input="changed"
            @keydown="keydown"
            @compositionstart="compositionStart"
            @compositionend="compositionEnd"
          />
          <div class="flex items-center gap-2">
            <Button
              variant="secondary"
              :disabled="lookupFailed"
              @click="parent"
              >{{ $t('pathCompletion.parent') }}</Button
            >
            <Button
              :variant="showAllFiles ? 'secondary' : 'textonly'"
              :icon="showAllFiles ? 'icon-[lucide--check]' : undefined"
              :aria-pressed="showAllFiles"
              :disabled="lookupFailed"
              @click="toggleFilter"
              >{{ $t('pathCompletion.showAllFiles') }}</Button
            >
          </div>
          <p v-if="editError" role="alert">{{ $t(editError) }}</p>
          <div v-if="statusMessage" role="status">
            {{ $t(statusMessage) }}
            <Button
              v-if="lookup.status === 'unavailable'"
              variant="secondary"
              @click="refresh"
              >{{ $t('g.retry') }}</Button
            >
          </div>
          <ul
            :id="listId"
            role="listbox"
            :aria-label="$t('pathCompletion.suggestions')"
            class="max-h-64 overflow-auto"
          >
            <li v-for="(item, index) in items" :key="index" role="presentation">
              <Button
                :id="`${listId}-${index}`"
                type="button"
                role="option"
                :aria-selected="active === index"
                tabindex="-1"
                :variant="active === index ? 'secondary' : 'textonly'"
                class="w-full justify-start"
                @mousedown.prevent
                @click="select(item, true)"
              >
                <i :class="kindIcon[item.kind]" aria-hidden="true" />
                <span class="min-w-0 truncate">{{ item.label }}</span>
              </Button>
            </li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="secondary" @click="emit('close')">{{
            $t('g.cancel')
          }}</Button>
          <Button @click="confirm">{{ $t('g.confirm') }}</Button>
        </DialogFooter>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>
