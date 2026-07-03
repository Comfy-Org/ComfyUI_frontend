<template>
  <div class="relative size-full">
    <div
      ref="editorEl"
      role="textbox"
      :contenteditable="readonly ? 'false' : 'true'"
      spellcheck="false"
      data-testid="prompt-editor"
      class="size-full overflow-auto rounded-sm border border-border-default bg-component-node-widget-background p-2 wrap-break-word whitespace-pre-wrap outline-none"
      @input="onInput"
      @keydown="onKeydown"
      @keyup="onKeyup"
      @click="detectMention"
      @paste="onPaste"
      @blur="onBlur"
    />
    <span
      v-if="isEmpty && placeholder"
      class="pointer-events-none absolute top-2 left-2 text-muted-foreground"
    >
      {{ placeholder }}
    </span>

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
            :key="item.name"
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
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import {
  CHIP_SELECTOR,
  createChipElement,
  parseElementToTemplate,
  renderTemplateToElement
} from '@/platform/prompts/promptTemplateDom'
import type { PromptTemplate } from '@/platform/prompts/promptTypes'

const {
  variableNames = [],
  connectedNames = [],
  placeholder = '',
  readonly = false
} = defineProps<{
  /** `@` variable references this editor may offer and resolve. */
  variableNames?: string[]
  /** Variables that are wired up, so their chips render as resolved. */
  connectedNames?: string[]
  placeholder?: string
  readonly?: boolean
}>()

const modelValue = defineModel<PromptTemplate>({ default: () => [] })

const { t } = useI18n()

const editorEl = ref<HTMLElement>()
const isEmpty = computed(() => (modelValue.value ?? []).length === 0)

let lastSerialized = ''

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
  refreshChipStates()
}

watch(modelValue, (value) => {
  const serialized = JSON.stringify(value ?? [])
  if (serialized === lastSerialized) return
  lastSerialized = serialized
  renderFromModel()
})

watch(() => connectedNames, refreshChipStates)

onMounted(() => {
  renderFromModel()
  lastSerialized = JSON.stringify(modelValue.value ?? [])
})

function refreshChipStates() {
  const host = editorEl.value
  if (!host) return
  const connected = new Set(connectedNames)
  for (const chip of host.querySelectorAll<HTMLElement>(CHIP_SELECTOR)) {
    const resolvable = connected.has(chip.getAttribute('data-chip-name') ?? '')
    chip.classList.toggle('bg-primary-background/50', resolvable)
    chip.classList.toggle('bg-destructive-background', !resolvable)
  }
}

// --- @ mention autocomplete ----------------------------------------------
interface MenuItem {
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
  const vars: MenuItem[] = variableNames
    .filter((name) => name.toLowerCase().includes(lower))
    .map((name) => ({ name }))
  const trimmed = query.trim()
  const create: MenuItem[] =
    trimmed && !variableNames.includes(trimmed)
      ? [{ name: trimmed, create: true }]
      : []
  menuItems.value = [...vars, ...create]
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
    marker.textContent = '​'
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
  const { node, start, end } = mentionAnchor
  const parent = node.parentNode
  if (!parent) return

  const text = node.textContent ?? ''
  node.textContent = text.slice(0, start)
  const after = document.createTextNode(` ${text.slice(end)}`)
  const chip = createChipElement(item.name)
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
  // Escape closed the menu on keydown; without this guard its keyup would
  // re-run mention detection and instantly reopen the menu.
  if (event.key === 'Escape') return
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
