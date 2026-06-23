<template>
  <div
    class="flex size-full min-h-[180px] flex-col gap-1 text-xs"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
    @wheel.stop
  >
    <div class="flex items-center gap-1">
      <SearchAutocomplete
        v-model="search"
        class="min-w-0 flex-1"
        input-class="bg-component-node-widget-background"
        size="sm"
        :placeholder="t('promptNode.searchPlaceholder')"
        :suggestions="promptSuggestions"
        option-label="name"
        option-key="id"
        @select="loadPrompt"
      />
      <Button
        size="icon-sm"
        variant="textonly"
        :title="t('promptNode.saveAsPrompt')"
        @click="toggleSave"
      >
        <i class="icon-[lucide--save] size-4" />
      </Button>
    </div>

    <div
      v-if="showSave"
      class="flex items-center gap-1"
      @keydown.enter.stop.prevent="confirmSave"
      @keydown.escape.stop.prevent="showSave = false"
    >
      <input
        ref="nameInputEl"
        v-model="saveName"
        class="min-w-0 flex-1 rounded-sm border border-border-default bg-base-background px-2 py-1 outline-none"
        :placeholder="t('promptNode.namePlaceholder')"
      />
      <Button
        size="sm"
        :disabled="!canSave"
        :loading="isSaving"
        @click="confirmSave"
      >
        {{ t('g.save') }}
      </Button>
    </div>

    <div class="relative min-h-0 flex-1">
      <div
        ref="editorEl"
        role="textbox"
        :contenteditable="isReadOnly ? 'false' : 'true'"
        spellcheck="false"
        data-testid="prompt-editor"
        class="size-full overflow-auto rounded-sm border border-border-default bg-component-node-widget-background p-2 wrap-break-word whitespace-pre-wrap outline-none"
        @input="onInput"
        @keydown="onKeydown"
        @keyup="onKeyup"
        @click="detectMention"
        @dblclick="onExpandChip"
        @paste="onPaste"
        @blur="onBlur"
      />
      <span
        v-if="isEmpty"
        class="pointer-events-none absolute top-2 left-2 text-muted-foreground"
      >
        {{ t('promptNode.editorPlaceholder') }}
      </span>
    </div>

    <Teleport to="body">
      <div
        v-if="menuOpen"
        class="fixed z-3000 max-h-60 w-56 overflow-y-auto rounded-lg border border-border-default bg-base-background p-1 text-xs shadow-lg"
        :style="{ top: `${menuTop}px`, left: `${menuLeft}px` }"
        @mousedown.prevent
      >
        <template v-if="menuItems.length">
          <Button
            v-for="(item, index) in menuItems"
            :key="`${item.kind}:${item.id ?? item.name}`"
            variant="textonly"
            size="sm"
            :class="
              cn(
                'w-full justify-start',
                index === highlighted && 'bg-secondary-background-hover'
              )
            "
            @mouseenter="highlighted = index"
            @click="selectItem(item)"
          >
            <span class="truncate">{{
              item.create
                ? t('promptNode.createVariable', { name: item.name })
                : item.name
            }}</span>
          </Button>
        </template>
        <div v-else class="px-2 py-1.5 text-muted-foreground">
          {{ t('promptNode.noMatches') }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import SearchAutocomplete from '@/components/ui/search-input/SearchAutocomplete.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  CHIP_SELECTOR,
  createChipElement,
  createTemplateFragment,
  parseElementToTemplate,
  renderTemplateToElement
} from '@/platform/prompts/promptTemplateDom'
import type {
  Prompt,
  PromptSegment,
  PromptTemplate
} from '@/platform/prompts/schemas/promptTypes'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { usePromptStore } from '@/stores/promptStore'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const { widget, nodeId } = defineProps<{
  widget?: SimplifiedWidget<PromptTemplate>
  nodeId: string
}>()

const modelValue = defineModel<PromptTemplate>({ default: () => [] })

const { t } = useI18n()
const store = usePromptStore()
const canvasStore = useCanvasStore()

const editorEl = ref<HTMLElement>()
const search = ref('')

const promptSuggestions = computed<Prompt[]>(() => store.prompts)
const isEmpty = computed(() => (modelValue.value ?? []).length === 0)
const isReadOnly = computed(() =>
  Boolean(widget?.options?.read_only || widget?.options?.disabled)
)

function getNode(): LGraphNode | undefined {
  return canvasStore.canvas?.graph?.getNodeById(nodeId) ?? undefined
}

type VariableSyncNode = LGraphNode & {
  syncVariableInputs: (names: string[]) => void
}

function variableSyncNode(): VariableSyncNode | undefined {
  const node = getNode()
  return node && 'syncVariableInputs' in node
    ? (node as VariableSyncNode)
    : undefined
}

/** Names of the node's variable input sockets, offered as `@` references. */
function variableSocketNames(): string[] {
  const names = new Set<string>()
  for (const input of getNode()?.inputs ?? []) {
    if (input.name) names.add(input.name)
  }
  return [...names]
}

/** Variable sockets that are wired up, so their `@` chips resolve to a value. */
function connectedVariableNames(): Set<string> {
  const names = new Set<string>()
  for (const input of getNode()?.inputs ?? []) {
    if (input.link != null && input.name) names.add(input.name)
  }
  return names
}

/** Mirrors the variables declared in the editor onto the node as input sockets. */
function syncVariableInputs(template: PromptTemplate) {
  const node = variableSyncNode()
  if (!node) return
  const names: string[] = []
  for (const segment of template) {
    if (segment.type === 'var' && !names.includes(segment.name)) {
      names.push(segment.name)
    }
  }
  const key = JSON.stringify(names)
  if (key === lastVarKey) return
  lastVarKey = key
  node.syncVariableInputs(names)
}

let lastSerialized = ''
let lastVarKey = ''

function renderFromModel() {
  if (!editorEl.value) return
  renderTemplateToElement(editorEl.value, modelValue.value ?? [])
  refreshChipStates()
}

function syncFromEditor() {
  if (!editorEl.value) return
  const template = parseElementToTemplate(editorEl.value)
  lastSerialized = JSON.stringify(template)
  modelValue.value = template
  syncVariableInputs(template)
  refreshChipStates()
}

watch(modelValue, (value) => {
  const serialized = JSON.stringify(value ?? [])
  if (serialized === lastSerialized) return
  lastSerialized = serialized
  renderFromModel()
})

watch(() => store.prompts, refreshChipStates, { deep: true })

// Recolor chips when the node's input sockets change — e.g. a variable's
// upstream connection is made or removed — not only on text edits.
watch(
  () =>
    (getNode()?.inputs ?? [])
      .map((input) => `${input.name ?? ''}:${input.link ?? ''}`)
      .join('|'),
  () => refreshChipStates()
)

onMounted(() => {
  renderFromModel()
  lastSerialized = JSON.stringify(modelValue.value ?? [])
  void store.loadPrompts().catch((error) => {
    console.error('[PromptNode] Failed to load saved prompts', error)
  })
})

function refreshChipStates() {
  const host = editorEl.value
  if (!host) return
  const connected = connectedVariableNames()
  for (const chip of host.querySelectorAll<HTMLElement>(CHIP_SELECTOR)) {
    const type = chip.getAttribute('data-chip-type')
    const resolvable =
      type === 'asset'
        ? !!store.getPrompt(chip.getAttribute('data-chip-id') ?? '')
        : connected.has(chip.getAttribute('data-chip-name') ?? '')
    chip.classList.toggle('bg-primary-background', resolvable)
    chip.classList.toggle('bg-destructive-background', !resolvable)
  }
}

function loadPrompt(prompt: Prompt) {
  void applySelectedPrompt(prompt)
}

async function applySelectedPrompt(prompt: Prompt) {
  search.value = ''
  let template = prompt.template
  if (!template.length) {
    try {
      template = await store.resolveTemplate(prompt.id)
    } catch (error) {
      console.error('[PromptNode] Failed to load prompt content', error)
      return
    }
  }
  const cloned: PromptTemplate = JSON.parse(JSON.stringify(template))
  lastSerialized = JSON.stringify(cloned)
  modelValue.value = cloned
  syncVariableInputs(cloned)
  if (editorEl.value) {
    renderTemplateToElement(editorEl.value, cloned)
    refreshChipStates()
  }
}

/**
 * Double-clicking a saved-prompt chip expands it in place into its referenced
 * text (and any nested chips), so the full content becomes directly editable.
 */
function onExpandChip(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const chip = target?.closest<HTMLElement>(CHIP_SELECTOR)
  if (!chip || chip.getAttribute('data-chip-type') !== 'asset') return
  event.preventDefault()
  void expandChip(chip, chip.getAttribute('data-chip-id') ?? '')
}

async function expandChip(chip: HTMLElement, id: string) {
  let template = store.getPrompt(id)?.template
  if (!template?.length) {
    try {
      template = await store.resolveTemplate(id)
    } catch (error) {
      console.error('[PromptNode] Failed to load prompt content', error)
      return
    }
  }
  if (!template.length || !chip.isConnected) return

  const fragment = createTemplateFragment(template)
  const lastNode = fragment.lastChild
  chip.replaceWith(fragment)
  if (lastNode) {
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStartAfter(lastNode)
    range.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  syncFromEditor()
}

// --- Save as prompt -------------------------------------------------------
const showSave = ref(false)
const saveName = ref('')
const isSaving = ref(false)
const nameInputEl = ref<HTMLInputElement>()

const canSave = computed(
  () => saveName.value.trim().length > 0 && !isEmpty.value && !isSaving.value
)

function toggleSave() {
  showSave.value = !showSave.value
  if (showSave.value) void nextTick(() => nameInputEl.value?.focus())
}

async function confirmSave() {
  if (!canSave.value || !editorEl.value) return
  isSaving.value = true
  try {
    await store.savePrompt({
      name: saveName.value.trim(),
      template: parseElementToTemplate(editorEl.value)
    })
    showSave.value = false
    saveName.value = ''
  } finally {
    isSaving.value = false
  }
}

// --- @ mention autocomplete ----------------------------------------------
interface MenuItem {
  kind: 'asset' | 'var'
  id?: string
  name: string
  create?: boolean
}

const menuOpen = ref(false)
const menuItems = ref<MenuItem[]>([])
const menuQuery = ref('')
const highlighted = ref(0)
const menuTop = ref(0)
const menuLeft = ref(0)

interface MentionAnchor {
  node: Text
  start: number
  end: number
}
let mentionAnchor: MentionAnchor | null = null

function closeMenu() {
  menuOpen.value = false
  mentionAnchor = null
}

function recomputeMenu() {
  const query = menuQuery.value
  const lower = query.toLowerCase()
  const matches = (name: string) => name.toLowerCase().includes(lower)
  const existing = variableSocketNames()
  const vars: MenuItem[] = existing
    .filter(matches)
    .map((name) => ({ kind: 'var', name }))
  const prompts: MenuItem[] = store.prompts
    .filter((prompt) => matches(prompt.name))
    .map((prompt) => ({ kind: 'asset', id: prompt.id, name: prompt.name }))
  const trimmed = query.trim()
  const create: MenuItem[] =
    trimmed && !existing.includes(trimmed)
      ? [{ kind: 'var', name: trimmed, create: true }]
      : []
  menuItems.value = [...create, ...vars, ...prompts]
  highlighted.value = 0
}

function detectMention() {
  const host = editorEl.value
  const selection = window.getSelection()
  if (
    !host ||
    !selection ||
    !selection.isCollapsed ||
    selection.rangeCount === 0
  ) {
    return closeMenu()
  }

  const node = selection.anchorNode
  if (!node || node.nodeType !== Node.TEXT_NODE || !host.contains(node)) {
    return closeMenu()
  }

  const textNode = node as Text
  const offset = selection.anchorOffset
  const before = (textNode.textContent ?? '').slice(0, offset)
  const match = /(?:^|\s)@([^\s@]*)$/.exec(before)
  if (!match) return closeMenu()

  menuQuery.value = match[1]
  mentionAnchor = {
    node: textNode,
    start: offset - match[1].length - 1,
    end: offset
  }
  recomputeMenu()
  positionMenu()
  menuOpen.value = true
}

function positionMenu() {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0).cloneRange()
  range.collapse(true)
  let rect = range.getBoundingClientRect()
  if (!rect.height && !rect.width) {
    const marker = document.createElement('span')
    marker.textContent = '\u200B'
    range.insertNode(marker)
    rect = marker.getBoundingClientRect()
    marker.remove()
    editorEl.value?.normalize()
  }
  menuTop.value = rect.bottom + 4
  menuLeft.value = rect.left
}

function selectItem(item: MenuItem) {
  if (!mentionAnchor) return
  const segment: PromptSegment =
    item.kind === 'asset'
      ? { type: 'asset', id: item.id ?? '', name: item.name }
      : { type: 'var', name: item.name }

  const { node, start, end } = mentionAnchor
  const parent = node.parentNode
  if (!parent) return

  const text = node.textContent ?? ''
  node.textContent = text.slice(0, start)
  const after = document.createTextNode(` ${text.slice(end)}`)
  const chip = createChipElement(
    segment as Extract<PromptSegment, { type: 'asset' | 'var' }>
  )
  parent.insertBefore(after, node.nextSibling)
  parent.insertBefore(chip, after)
  setCaret(after, 1)

  closeMenu()
  syncFromEditor()
}

function setCaret(node: Node, offset: number) {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.setStart(node, Math.min(offset, node.textContent?.length ?? 0))
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

function insertTextAtCaret(value: string) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode(value)
  range.insertNode(node)
  setCaret(node, value.length)
}

const MENU_NAV_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'Enter',
  'Tab',
  'Escape'
])

function onKeydown(event: KeyboardEvent) {
  event.stopPropagation()

  if (menuOpen.value) {
    const count = menuItems.value.length
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault()
      highlighted.value = (highlighted.value + 1) % count
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault()
      highlighted.value = (highlighted.value - 1 + count) % count
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      if (count) selectItem(menuItems.value[highlighted.value])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
    }
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    insertTextAtCaret('\n')
    syncFromEditor()
  }
}

function onKeyup(event: KeyboardEvent) {
  if (menuOpen.value && MENU_NAV_KEYS.has(event.key)) return
  detectMention()
}

function onInput() {
  syncFromEditor()
  detectMention()
}

function onPaste(event: ClipboardEvent) {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (text) {
    insertTextAtCaret(text)
    syncFromEditor()
  }
}

function onBlur() {
  window.setTimeout(closeMenu, 150)
}
</script>
