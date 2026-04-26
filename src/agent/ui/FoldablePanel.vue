<template>
  <div
    v-if="store.isOpen"
    v-show="positioned"
    ref="panelEl"
    class="agent-foldable-panel border-default/30 pointer-events-auto fixed flex flex-col rounded-lg border bg-comfy-menu-bg/80 shadow-2xl backdrop-blur-xl backdrop-saturate-150"
    data-testid="agent-panel"
    :style="[
      panelStyle,
      {
        zIndex: 9998,
        width: size.width + 'px',
        height: size.height + 'px'
      }
    ]"
  >
    <header
      ref="dragHandleRef"
      class="border-default/30 flex cursor-grab items-center justify-between border-b px-3 py-2 select-none active:cursor-grabbing"
    >
      <div class="flex items-center gap-2">
        <img
          src="/assets/images/comfy-logo-single.svg"
          :alt="t('agent.panel.logoAlt')"
          :class="cn('size-4 select-none', store.isStreaming && 'animate-spin')"
          draggable="false"
        />
        <span
          v-if="!showSettings"
          data-testid="agent-panel-title"
          class="rounded-sm bg-charcoal-700 px-1.5 py-0.5 font-serif text-xs font-semibold tracking-wider text-electric-400 italic"
        >
          {{ t('agent.panel.brandTitle') }}
        </span>
        <span v-else class="text-sm font-medium text-(--fg-color)">
          {{ t('agent.settings.title') }}
        </span>
      </div>
      <div class="flex items-center gap-0.5">
        <button
          v-if="!showSettings"
          :class="iconBtnClass(false)"
          :title="
            allFolded ? t('agent.panel.unfoldAll') : t('agent.panel.foldAll')
          "
          @click.stop="toggleAllFolds"
        >
          <i
            :class="
              cn(
                'size-3.5',
                allFolded
                  ? 'icon-[lucide--unfold-vertical]'
                  : 'icon-[lucide--fold-vertical]'
              )
            "
          />
        </button>
        <button
          v-if="!showSettings && store.isStreaming"
          :class="iconBtnClass(false)"
          :aria-label="t('agent.panel.stop')"
          @click.stop="session.stop()"
        >
          <i class="icon-[lucide--square] size-3.5" />
        </button>
        <button
          v-if="!showSettings"
          :class="iconBtnClass(false)"
          :aria-label="t('agent.panel.clear')"
          @click.stop="clearAll()"
        >
          <i class="icon-[lucide--eraser] size-3.5" />
        </button>
        <button
          :class="iconBtnClass(showSettings)"
          :aria-label="t('agent.panel.settings')"
          :aria-pressed="showSettings"
          @click.stop="showSettings = !showSettings"
        >
          <i
            :class="
              cn(
                'size-3.5',
                showSettings
                  ? 'icon-[lucide--terminal]'
                  : 'icon-[lucide--settings]'
              )
            "
          />
        </button>
        <button
          :class="iconBtnClass(false, true)"
          :aria-label="t('agent.panel.close')"
          @click.stop="store.close()"
        >
          <i class="icon-[lucide--x] size-3.5" />
        </button>
      </div>
    </header>

    <AgentSettings v-if="showSettings" />

    <div
      v-else
      class="terminal-host relative flex flex-1 flex-col overflow-hidden"
      data-testid="agent-terminal"
      @dragover.prevent.capture="isHovering = true"
      @dragleave.capture="isHovering = false"
      @drop.prevent.stop.capture="onDrop"
      @paste.capture="onPaste"
    >
      <div
        ref="scrollEl"
        class="flex-1 overflow-y-auto p-2 font-mono text-xs/snug"
        @scroll="onScroll"
        @mousedown="onScrollMouseDown"
      >
        <div v-for="m in store.messages" :key="m.id" class="agent-block">
          <div
            v-if="m.role === 'user'"
            class="my-1 wrap-break-word whitespace-pre-wrap text-azure-400"
          >
            <span class="opacity-60 select-none">&gt; </span>{{ m.text }}
          </div>
          <div
            v-else-if="m.role === 'assistant'"
            class="my-1 wrap-break-word whitespace-pre-wrap text-(--fg-color)"
          >
            {{ m.text || (store.isStreaming ? '…' : '') }}
          </div>
          <div
            v-else-if="m.tool"
            :class="
              cn(
                'border-default/30 my-1 rounded-sm border bg-secondary-background/40 transition',
                'hover:border-default/60'
              )
            "
          >
            <button
              :class="
                cn(
                  'flex w-full items-center gap-1.5 px-2 py-1 text-left',
                  'hover:bg-secondary-background/70'
                )
              "
              @click="toggleFold(m.id)"
            >
              <i
                :class="
                  cn(
                    'size-3 shrink-0',
                    isFolded(m.id)
                      ? 'icon-[lucide--chevron-right]'
                      : 'icon-[lucide--chevron-down]'
                  )
                "
              />
              <span class="opacity-60 select-none">$</span>
              <span class="flex-1 truncate text-(--fg-color)">{{
                summariseScript(m.tool.script)
              }}</span>
              <span
                :class="
                  cn(
                    'shrink-0 text-xs tabular-nums',
                    m.tool.exitCode === 0
                      ? 'text-emerald-400'
                      : 'text-coral-500'
                  )
                "
              >
                {{
                  t('agent.panel.toolFolded', {
                    count: countLines(m.tool.stdout, m.tool.stderr),
                    exit: m.tool.exitCode
                  })
                }}
              </span>
            </button>
            <div
              v-if="!isFolded(m.id)"
              class="border-default/30 border-t px-2 py-1.5"
            >
              <pre
                v-if="m.tool.stdout"
                class="wrap-break-word whitespace-pre-wrap text-(--fg-color)/85"
                >{{ m.tool.stdout }}</pre
              >
              <pre
                v-if="m.tool.stderr"
                class="mt-1 wrap-break-word whitespace-pre-wrap text-coral-500"
              >
[stderr] {{ m.tool.stderr }}</pre
              >
            </div>
          </div>
          <div
            v-else
            class="my-1 wrap-break-word whitespace-pre-wrap text-muted-foreground/70"
          >
            {{ m.text }}
          </div>
        </div>
        <div
          v-if="store.messages.length === 0"
          class="text-muted-foreground/70"
        >
          {{ t('agent.panel.prompt') }} {{ t('agent.panel.brandTitle') }}
          {{ t('agent.panel.readyHint') }}
        </div>

        <div
          v-if="store.pendingAssets.length > 0"
          class="my-1 flex flex-wrap gap-1"
        >
          <div
            v-for="asset in store.pendingAssets"
            :key="asset.id"
            class="group flex items-center gap-1 rounded-sm bg-secondary-background/60 px-1.5 py-0.5 text-xs"
          >
            <img
              v-if="asset.previewUrl"
              :src="asset.previewUrl"
              :alt="asset.name"
              class="size-5 rounded-sm object-cover"
            />
            <i v-else class="icon-[lucide--file] size-3" />
            <span class="max-w-32 truncate">{{ asset.path }}</span>
            <button
              class="opacity-50 hover:opacity-100"
              :aria-label="t('agent.input.removeAsset')"
              @click="store.removePendingAsset(asset.id)"
            >
              <i class="icon-[lucide--x] size-3" />
            </button>
          </div>
        </div>

        <!--
          Inline prompt — visually flows as the next line of scrollback
          rather than a separate input widget. Same font / colour scheme
          as user-message blocks; no border, no background.
        -->
        <div class="agent-prompt-row flex items-start gap-1.5">
          <span class="text-azure-400 select-none">{{
            t('agent.panel.prompt')
          }}</span>
          <textarea
            ref="inputEl"
            v-model="inputText"
            rows="1"
            autocomplete="off"
            spellcheck="false"
            :placeholder="
              store.isStreaming
                ? t('agent.panel.streamingPlaceholder')
                : t('agent.panel.inputPlaceholder')
            "
            :class="
              cn(
                'flex-1 resize-none border-0 bg-transparent p-0 font-mono text-xs/snug',
                'text-(--fg-color) placeholder:text-muted-foreground/50',
                'focus:ring-0 focus:outline-none'
              )
            "
            @keydown="onInputKey"
            @input="autoGrow"
          />
        </div>
      </div>

      <div
        v-if="isHovering"
        class="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed border-azure-600 bg-azure-600/10 text-sm text-white"
      >
        {{ t('agent.panel.dropHint') }}
      </div>
    </div>

    <div
      class="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize"
      :aria-label="t('agent.panel.resize')"
      @pointerdown.stop="(e) => startResize(e, 'e')"
    />
    <div
      class="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
      :aria-label="t('agent.panel.resize')"
      @pointerdown.stop="(e) => startResize(e, 's')"
    />
    <div
      class="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize"
      :aria-label="t('agent.panel.resize')"
      @pointerdown.stop="(e) => startResize(e, 'w')"
    />
    <div
      class="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize"
      :aria-label="t('agent.panel.resize')"
      @pointerdown.stop="(e) => startResize(e, 'n')"
    />
    <div
      class="absolute right-0 bottom-0 size-3 cursor-se-resize"
      :aria-label="t('agent.panel.resize')"
      @pointerdown.stop="(e) => startResize(e, 'se')"
    />
    <div
      class="absolute bottom-0 left-0 size-3 cursor-sw-resize"
      :aria-label="t('agent.panel.resize')"
      @pointerdown.stop="(e) => startResize(e, 'sw')"
    />
    <div
      class="absolute top-0 right-0 size-3 cursor-ne-resize"
      :aria-label="t('agent.panel.resize')"
      @pointerdown.stop="(e) => startResize(e, 'ne')"
    />
    <div
      class="absolute top-0 left-0 size-3 cursor-nw-resize"
      :aria-label="t('agent.panel.resize')"
      @pointerdown.stop="(e) => startResize(e, 'nw')"
    />
  </div>
</template>

<script setup lang="ts">
import { useDraggable, useLocalStorage, watchDebounced } from '@vueuse/core'
import { clamp } from 'es-toolkit'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

import { useAssetIngest } from '../composables/useAssetIngest'
import { useAgentSession } from '../composables/useAgentSession'
import { dropImageAsLoadImageNode } from '../composables/useImageNodeDrop'
import { log as logEntry } from '../services/logger'
import { useAgentStore } from '../stores/agentStore'
import AgentSettings from './AgentSettings.vue'

const PANEL_W = 560
const PANEL_H = 560
const PANEL_MIN_W = 320
const PANEL_MIN_H = 240
const HISTORY_KEY = 'Comfy.Agent.InputHistory'
const MAX_HISTORY = 100

const { t } = useI18n()
const store = useAgentStore()
const session = useAgentSession()
const { ingestFromClipboard } = useAssetIngest()

const panelEl = ref<HTMLElement | null>(null)
const dragHandleRef = ref<HTMLElement | null>(null)
const scrollEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const showSettings = ref(!session.apiKey.value)
const positioned = ref(false)
const isHovering = ref(false)

// Tool messages start folded so the scrollback stays compact. Track per-id
// override so users can pin individual blocks open even when the global
// "fold all" toggle is on.
const explicitFold = ref<Map<string, boolean>>(new Map())
const allFolded = ref(true)

function isFolded(id: string): boolean {
  const explicit = explicitFold.value.get(id)
  if (explicit !== undefined) return explicit
  return allFolded.value
}

function toggleFold(id: string): void {
  explicitFold.value.set(id, !isFolded(id))
  // Force reactivity on Map mutation
  explicitFold.value = new Map(explicitFold.value)
}

function toggleAllFolds(): void {
  allFolded.value = !allFolded.value
  // Reset per-id overrides so the global state actually applies everywhere.
  explicitFold.value = new Map()
}

const inputText = ref('')
const inputHistory = useLocalStorage<string[]>(HISTORY_KEY, [])
const historyIndex = ref<number | null>(null)

const savedPos = useLocalStorage('Comfy.Agent.PanelPosition', { x: 0, y: 0 })
const size = useLocalStorage('Comfy.Agent.PanelSize', {
  width: PANEL_W,
  height: PANEL_H
})

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

function startResize(e: PointerEvent, dir: ResizeDir): void {
  const startX = e.clientX
  const startY = e.clientY
  const startW = size.value.width
  const startH = size.value.height
  const startPosX = x.value
  const startPosY = y.value
  const movesX = dir.includes('w')
  const movesY = dir.includes('n')
  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    let newW = startW
    let newH = startH
    if (dir.includes('e')) newW = Math.max(PANEL_MIN_W, startW + dx)
    if (dir.includes('w')) newW = Math.max(PANEL_MIN_W, startW - dx)
    if (dir.includes('s')) newH = Math.max(PANEL_MIN_H, startH + dy)
    if (dir.includes('n')) newH = Math.max(PANEL_MIN_H, startH - dy)
    size.value = { width: newW, height: newH }
    if (movesX) x.value = startPosX + (startW - newW)
    if (movesY) y.value = startPosY + (startH - newH)
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

const {
  x,
  y,
  style: panelStyle
} = useDraggable(panelEl, {
  initialValue: savedPos.value,
  handle: dragHandleRef,
  containerElement: document.body
})

watchDebounced(
  [x, y],
  ([nx, ny]) => {
    savedPos.value = { x: nx, y: ny }
  },
  { debounce: 300 }
)

function setDefaultPosition(): void {
  const w = size.value.width
  const h = size.value.height
  if (savedPos.value.x === 0 && savedPos.value.y === 0) {
    x.value = Math.max(0, window.innerWidth - w - 400)
    y.value = Math.max(0, window.innerHeight - h - 24)
  } else {
    x.value = clamp(savedPos.value.x, 0, window.innerWidth - w)
    y.value = clamp(savedPos.value.y, 0, window.innerHeight - h)
  }
  positioned.value = true
}

function iconBtnClass(active: boolean, danger = false): string {
  return cn(
    'flex size-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition',
    active
      ? 'border-azure-600/60 bg-azure-600/20 text-azure-600'
      : danger
        ? 'hover:border-coral-500/40 hover:bg-coral-500/15 hover:text-coral-500'
        : 'hover:border-default/40 hover:bg-secondary-background/60 hover:text-(--fg-color)',
    'focus-visible:ring-2 focus-visible:ring-azure-600 focus-visible:outline-none active:scale-95'
  )
}

function summariseScript(script: string): string {
  // Single line preview — collapse any internal newlines, trim long lines.
  const single = script.replace(/\s+/g, ' ').trim()
  return single.length > 200 ? single.slice(0, 200) + '…' : single
}

function countLines(stdout: string, stderr?: string): number {
  let n = 0
  if (stdout) n += stdout.split('\n').filter((l) => l.length > 0).length
  if (stderr) n += stderr.split('\n').filter((l) => l.length > 0).length
  return n
}

const userScrolledUp = ref(false)

function onScroll(): void {
  const el = scrollEl.value
  if (!el) return
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  // 80px slack so micro-scrolls during streaming still count as "at bottom"
  userScrolledUp.value = distanceFromBottom > 80
}

function scrollToBottom(force = false): void {
  void nextTick(() => {
    const el = scrollEl.value
    if (!el) return
    if (force || !userScrolledUp.value) {
      el.scrollTop = el.scrollHeight
    }
  })
}

watch(
  () => store.messages.length,
  () => scrollToBottom()
)
watch(
  () => store.messages.map((m) => m.text).join('\n').length,
  () => scrollToBottom()
)

function isDirectShellCommand(line: string): boolean {
  const first = line.trim().split(/\s+/)[0]
  if (!first) return false
  const ctx = session.buildExecContextOnce()
  return !!ctx.registry.get(first) || /^[|&;<>/]/.test(first)
}

async function handleSubmit(line: string): Promise<void> {
  const trimmed = line.trim()
  if (!trimmed && store.pendingAssets.length === 0) return

  if (trimmed) {
    inputHistory.value = [
      ...inputHistory.value.filter((h) => h !== trimmed),
      trimmed
    ].slice(-MAX_HISTORY)
  }
  historyIndex.value = null

  const assets = store.consumePendingAssets()

  if (trimmed && isDirectShellCommand(trimmed)) {
    logEntry({ kind: 'user', text: trimmed })
    store.addMessage({ role: 'user', text: trimmed })
    try {
      const result = await session.execShell(trimmed)
      logEntry({
        kind: 'tool',
        script: trimmed,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode
      })
      store.addMessage({
        role: 'system',
        text: `$ ${trimmed}\n${result.stdout}${result.stderr ? `\n[stderr] ${result.stderr}` : ''}`,
        tool: {
          script: trimmed,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode
        }
      })
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err)
      logEntry({ kind: 'error', text })
      store.addMessage({ role: 'system', text: `error: ${text}` })
    }
    return
  }

  await session.send(trimmed, assets)
}

function autoGrow(): void {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

async function onInputKey(e: KeyboardEvent): Promise<void> {
  if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
    e.preventDefault()
    if (store.isStreaming) return
    const line = inputText.value
    inputText.value = ''
    autoGrow()
    await handleSubmit(line)
    return
  }
  if (e.key === 'ArrowUp' && (inputText.value === '' || e.altKey)) {
    e.preventDefault()
    const hist = inputHistory.value
    if (hist.length === 0) return
    historyIndex.value =
      historyIndex.value === null
        ? hist.length - 1
        : Math.max(0, historyIndex.value - 1)
    inputText.value = hist[historyIndex.value] ?? ''
    void nextTick(autoGrow)
    return
  }
  if (e.key === 'ArrowDown' && historyIndex.value !== null) {
    e.preventDefault()
    const hist = inputHistory.value
    historyIndex.value = historyIndex.value + 1
    if (historyIndex.value >= hist.length) {
      historyIndex.value = null
      inputText.value = ''
    } else {
      inputText.value = hist[historyIndex.value] ?? ''
    }
    void nextTick(autoGrow)
    return
  }
  if (e.key === 'l' && e.ctrlKey) {
    e.preventDefault()
    clearAll()
  }
}

function clearAll(): void {
  store.clearMessages()
  explicitFold.value = new Map()
  allFolded.value = true
  inputEl.value?.focus()
}

function focusInput(): void {
  void nextTick(() => inputEl.value?.focus())
}

/**
 * Click anywhere in the scrollback — but only on the bare container
 * itself, not on a message — focuses the input. Mirrors how a real
 * terminal lets you keep typing after scrolling away.
 */
function onScrollMouseDown(e: MouseEvent): void {
  const target = e.target as HTMLElement | null
  if (!target) return
  if (target === scrollEl.value) {
    focusInput()
  }
}

async function onDrop(e: DragEvent): Promise<void> {
  isHovering.value = false
  const dt = e.dataTransfer
  if (!dt) return
  const text =
    dt.getData('text/plain') ||
    dt.getData('text') ||
    dt.getData('text/uri-list')
  if (text && (!dt.files || dt.files.length === 0)) {
    inputText.value += text
    void nextTick(autoGrow)
    focusInput()
    return
  }
  const results = await ingestFromClipboard(dt)
  for (const r of results) {
    store.addPendingAsset(r.asset)
    const isImage = r.asset.mime.startsWith('image/')
    if (isImage && r.remote) {
      const filename = r.asset.path.replace(/^\/input\/?/, '')
      const nodeId = dropImageAsLoadImageNode(filename)
      store.addMessage({
        role: 'system',
        text:
          nodeId !== null
            ? `[+] LoadImage #${nodeId} — ${filename}`
            : `(uploaded ${filename} — could not add LoadImage node)`
      })
    } else {
      inputText.value += r.asset.path + ' '
    }
  }
  void nextTick(autoGrow)
  focusInput()
}

async function onPaste(e: ClipboardEvent): Promise<void> {
  if (!e.clipboardData) return
  const hasFiles = Array.from(e.clipboardData.items).some(
    (i) => i.kind === 'file'
  )
  if (!hasFiles) return
  e.stopPropagation()
  e.preventDefault()
  const results = await ingestFromClipboard(e.clipboardData)
  for (const r of results) {
    store.addPendingAsset(r.asset)
    inputText.value += r.asset.path + ' '
  }
  void nextTick(autoGrow)
}

watch(
  () => store.isOpen,
  (open) => {
    if (!open) return
    void nextTick(() => {
      setDefaultPosition()
      void nextTick(() => {
        scrollToBottom(true)
        focusInput()
      })
    })
  },
  { immediate: true }
)

// Global Ctrl+O / ⌘+O handler — registered on window so the browser's
// default "Open File" dialog can be preempted regardless of which element
// inside the panel currently has focus. Only acts while the panel is open.
function handleGlobalKey(e: KeyboardEvent): void {
  if (!store.isOpen) return
  if (e.key !== 'o' && e.key !== 'O') return
  if (!(e.ctrlKey || e.metaKey)) return
  if (e.altKey || e.shiftKey) return
  e.preventDefault()
  e.stopPropagation()
  toggleAllFolds()
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKey, { capture: true })
  if (store.isOpen) {
    setDefaultPosition()
    void nextTick(() => {
      scrollToBottom(true)
      focusInput()
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKey, { capture: true })
})
</script>

<style scoped>
.agent-block pre {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  margin: 0;
}
</style>
