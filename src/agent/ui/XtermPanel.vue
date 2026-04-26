<template>
  <div
    v-if="store.isOpen"
    v-show="positioned"
    ref="panelEl"
    class="agent-xterm-panel border-default/30 pointer-events-auto fixed flex flex-col rounded-lg border bg-comfy-menu-bg/80 shadow-2xl backdrop-blur-xl backdrop-saturate-150"
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
          v-if="!showSettings && store.isStreaming"
          :class="
            cn(
              'flex size-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition',
              'hover:border-default/40 hover:bg-secondary-background/60 hover:text-(--fg-color)',
              'focus-visible:ring-2 focus-visible:ring-azure-600 focus-visible:outline-none',
              'active:scale-95'
            )
          "
          :aria-label="t('agent.panel.stop')"
          @click.stop="session.stop()"
        >
          <i class="icon-[lucide--square] size-3.5" />
        </button>
        <button
          v-if="!showSettings"
          :class="
            cn(
              'flex size-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition',
              'hover:border-default/40 hover:bg-secondary-background/60 hover:text-(--fg-color)',
              'focus-visible:ring-2 focus-visible:ring-azure-600 focus-visible:outline-none',
              'active:scale-95'
            )
          "
          :aria-label="t('agent.panel.clear')"
          @click.stop="clearTerminal()"
        >
          <i class="icon-[lucide--eraser] size-3.5" />
        </button>
        <button
          :class="
            cn(
              'flex size-7 items-center justify-center rounded-md border transition',
              showSettings
                ? 'border-azure-600/60 bg-azure-600/20 text-azure-600'
                : 'hover:border-default/40 border-transparent text-muted-foreground hover:bg-secondary-background/60 hover:text-(--fg-color)',
              'focus-visible:ring-2 focus-visible:ring-azure-600 focus-visible:outline-none',
              'active:scale-95'
            )
          "
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
          :class="
            cn(
              'flex size-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition',
              'hover:border-coral-500/40 hover:bg-coral-500/15 hover:text-coral-500',
              'focus-visible:ring-2 focus-visible:ring-coral-500 focus-visible:outline-none',
              'active:scale-95'
            )
          "
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
      ref="terminalHost"
      class="terminal-host relative flex-1 overflow-hidden p-2"
      data-testid="agent-terminal"
      @dragover.prevent.capture="isHovering = true"
      @dragleave.capture="isHovering = false"
      @drop.prevent.stop.capture="onDrop"
      @paste.capture="onPaste"
    >
      <div ref="xtermEl" class="size-full" />

      <!-- drop overlay -->
      <div
        v-if="isHovering"
        class="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed border-azure-600 bg-azure-600/10 text-sm text-white"
      >
        {{ t('agent.panel.dropHint') }}
      </div>

      <!-- pending asset thumbnails -->
      <div
        v-if="store.pendingAssets.length > 0"
        class="border-default pointer-events-auto absolute inset-x-2 bottom-2 flex flex-wrap gap-1 rounded-sm border bg-comfy-menu-bg/95 p-1"
      >
        <div
          v-for="asset in store.pendingAssets"
          :key="asset.id"
          class="group relative flex items-center gap-1 rounded-sm bg-secondary-background px-1.5 py-0.5 text-xs"
        >
          <img
            v-if="asset.previewUrl"
            :src="asset.previewUrl"
            :alt="asset.name"
            class="size-5 rounded-sm object-cover"
          />
          <i v-else class="icon-[lucide--file] size-3" />
          <span class="max-w-32 truncate font-mono">{{ asset.path }}</span>
          <button
            class="opacity-50 hover:opacity-100"
            :aria-label="t('agent.input.removeAsset')"
            @click="store.removePendingAsset(asset.id)"
          >
            <i class="icon-[lucide--x] size-3" />
          </button>
        </div>
      </div>
    </div>

    <!-- resize handles: all four edges + all four corners -->
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
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { useDraggable, useLocalStorage, watchDebounced } from '@vueuse/core'
import { clamp, debounce } from 'es-toolkit'
import { markRaw, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

import { useAssetIngest } from '../composables/useAssetIngest'
import { useAgentSession } from '../composables/useAgentSession'
import { dropImageAsLoadImageNode } from '../composables/useImageNodeDrop'
import { log as logEntry } from '../services/logger'
import { useAgentStore } from '../stores/agentStore'
import AgentSettings from './AgentSettings.vue'
import { useXtermReadline } from './useXtermReadline'

const PANEL_W = 560
const PANEL_H = 560
const PANEL_MIN_W = 320
const PANEL_MIN_H = 240
// Welcome banner intentionally suppressed for token efficiency — pasting
// a transcript into an LLM used to carry the full ASCII art. Re-enable
// by restoring a BANNER/WELCOME constant and writeAnsi(WELCOME) in
// setupTerminal() and clearTerminal().

const { t } = useI18n()
const store = useAgentStore()
const session = useAgentSession()
const { ingestFromClipboard } = useAssetIngest()

const panelEl = ref<HTMLElement | null>(null)
const dragHandleRef = ref<HTMLElement | null>(null)
const terminalHost = ref<HTMLElement | null>(null)
const xtermEl = ref<HTMLElement | null>(null)
// Open the settings tab by default when the user has no API key
// configured — that's the onboarding flow. Once a key is set, return
// to the terminal view on next open.
const showSettings = ref(!session.apiKey.value)
const positioned = ref(false)
const isHovering = ref(false)

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

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let readline: ReturnType<typeof useXtermReadline> | null = null
let resizeObserver: ResizeObserver | null = null
let stopSessionHooks: (() => void) | null = null

function writeAnsi(text: string): void {
  if (!terminal) return
  // convertEol handles \n → \r\n; passthrough ANSI as-is
  terminal.write(text)
}

function isDirectShellCommand(line: string): boolean {
  const first = line.trim().split(/\s+/)[0]
  if (!first) return false
  const ctx = session.buildExecContextOnce()
  return !!ctx.registry.get(first) || /^[|&;<>/]/.test(first)
}

async function handleSubmit(line: string): Promise<void> {
  const trimmed = line.trim()
  if (!trimmed && store.pendingAssets.length === 0) {
    readline?.showPrompt()
    return
  }
  const assets = store.consumePendingAssets()

  if (trimmed && isDirectShellCommand(trimmed)) {
    logEntry({ kind: 'user', text: trimmed })
    // Direct shell exec — don't bother the LLM
    try {
      const result = await session.execShell(trimmed)
      logEntry({
        kind: 'tool',
        script: trimmed,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode
      })
      if (result.stdout) writeAnsi(result.stdout)
      if (result.stderr) writeAnsi('\x1b[31m' + result.stderr + '\x1b[0m\r\n')
      if (result.exitCode !== 0 && !result.stderr) {
        writeAnsi(`\x1b[90mexit ${result.exitCode}\x1b[0m\r\n`)
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err)
      logEntry({ kind: 'error', text })
      writeAnsi('\x1b[31merror: ' + text + '\x1b[0m\r\n')
    }
    readline?.showPrompt()
    return
  }

  // Natural language → LLM session
  await session.send(trimmed, assets)
  writeAnsi('\r\n')
  readline?.showPrompt()
}

function replayHistory(): void {
  // Replay persisted messages into the freshly-mounted terminal so the
  // user sees their chat history on reopen. Keep the formatting minimal —
  // user prompts prefixed, assistant text raw, system (tool traces) dim.
  for (const m of store.messages) {
    if (m.role === 'user') {
      writeAnsi('\x1b[36m> ' + m.text.replace(/\n/g, '\r\n') + '\x1b[0m\r\n')
    } else if (m.role === 'assistant') {
      if (m.text) writeAnsi(m.text.replace(/\n/g, '\r\n') + '\r\n')
    } else if (m.role === 'system') {
      writeAnsi('\x1b[90m' + m.text.replace(/\n/g, '\r\n') + '\x1b[0m\r\n')
    }
  }
  if (store.messages.length > 0) {
    writeAnsi(
      '\x1b[90m--- ' +
        store.messages.length +
        ' message(s) from previous session ---\x1b[0m\r\n'
    )
  }
}

function bindSessionHooks(): () => void {
  // Track each assistant message's prior text so we can emit only the delta
  // as it streams. Keyed by message id so tool-call (system) messages
  // inserted between turns don't confuse "latest message" tracking.
  // Seed lastEmitted with current assistant texts so the replay above
  // isn't duplicated once streaming begins.
  const lastEmitted = new Map<string, string>()
  for (const m of store.messages) {
    if (m.role === 'assistant') lastEmitted.set(m.id, m.text)
  }
  let lastLen = store.messages.length
  // Track what kind of content we last wrote so we can prefix assistant
  // narration with a visual divider — keeps the answer findable when a
  // long tool wall (e.g. graph node JSON dump) precedes it.
  let lastWrittenRole: 'system' | 'assistant' | null = null

  const stop = watch(
    store.messages,
    (msgs) => {
      // Handle newly-appended messages (user/system prefix + assistant init)
      for (let i = lastLen; i < msgs.length; i++) {
        const m = msgs[i]
        if (m.role === 'system') {
          writeAnsi('\x1b[90m' + m.text.replace(/\n/g, '\r\n') + '\x1b[0m\r\n')
          lastWrittenRole = 'system'
        } else if (m.role === 'assistant') {
          lastEmitted.set(m.id, '')
        }
      }
      lastLen = msgs.length

      // For each streaming assistant message, emit the new delta.
      for (const m of msgs) {
        if (m.role !== 'assistant') continue
        const prior = lastEmitted.get(m.id) ?? ''
        if (m.text.length > prior.length) {
          // First delta of a new assistant turn that comes after tool
          // output: print a labelled divider so the answer doesn't get
          // lost at the bottom of a JSON wall.
          if (prior === '' && lastWrittenRole === 'system') {
            writeAnsi('\x1b[36m\x1b[1m─── answer ───\x1b[0m\r\n')
          }
          writeAnsi(m.text.slice(prior.length))
          lastEmitted.set(m.id, m.text)
          lastWrittenRole = 'assistant'
          // Force the viewport to follow streaming text, even if the user
          // (or earlier code) scrolled up while tool output was rendering.
          terminal?.scrollToBottom()
        }
      }
    },
    { deep: true }
  )
  return stop
}

function clearTerminal(): void {
  terminal?.clear()
  store.clearMessages()
  readline?.showPrompt()
}

async function onDrop(e: DragEvent): Promise<void> {
  isHovering.value = false
  const dt = e.dataTransfer
  if (!dt) return

  // 1. Plain text drop (e.g. a selection from another window or tab)
  //    — inserted at the cursor so the user can review before submitting.
  const text =
    dt.getData('text/plain') ||
    dt.getData('text') ||
    dt.getData('text/uri-list')
  if (text && (!dt.files || dt.files.length === 0)) {
    readline?.paste(text)
    return
  }

  // 2. File drop — ingest as an asset.
  //    For image files, also spawn a LoadImage node on the canvas
  //    pre-filled with the uploaded filename so the user can wire it
  //    immediately. For other files, just insert the VFS path at the
  //    cursor so the agent can refer to it in the next prompt.
  const results = await ingestFromClipboard(dt)
  for (const r of results) {
    store.addPendingAsset(r.asset)
    const isImage = r.asset.mime.startsWith('image/')
    if (isImage && r.remote) {
      // The upload path looks like '/input/<subfolder>/<name>' — strip
      // the mount prefix to match the LoadImage widget's expectation.
      const filename = r.asset.path.replace(/^\/input\/?/, '')
      const nodeId = dropImageAsLoadImageNode(filename)
      writeAnsi(
        nodeId !== null
          ? `\x1b[32m[+] LoadImage #${nodeId} — ${filename}\x1b[0m\r\n`
          : `\x1b[33m(uploaded ${filename} — could not add LoadImage node)\x1b[0m\r\n`
      )
    } else {
      readline?.paste(r.asset.path + ' ')
    }
  }

  // 3. Fallback: nothing recognised — surface a brief error so the user
  //    knows the drop was received but not handled.
  if (results.length === 0 && !text) {
    writeAnsi(
      '\x1b[33m(drop received but no text or file content found)\x1b[0m\r\n'
    )
  }
}

async function onPaste(e: ClipboardEvent): Promise<void> {
  if (!e.clipboardData) return
  const hasFiles = Array.from(e.clipboardData.items).some(
    (i) => i.kind === 'file'
  )
  if (!hasFiles) return
  // Files: we handle; don't let xterm receive them
  e.stopPropagation()
  e.preventDefault()
  const results = await ingestFromClipboard(e.clipboardData)
  for (const r of results) {
    store.addPendingAsset(r.asset)
    readline?.paste(r.asset.path + ' ')
  }
}

function initTerminal(): void {
  if (terminal || !xtermEl.value) return
  fitAddon = new FitAddon()
  terminal = markRaw(
    new Terminal({
      convertEol: true,
      fontSize: 13,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", Consolas, monospace',
      cursorBlink: true,
      allowTransparency: true,
      theme: {
        background: 'rgba(0, 0, 0, 0)',
        // Read from the active ComfyUI palette so xterm text reverses
        // automatically when the user switches dark ↔ light.
        foreground:
          getComputedStyle(document.documentElement)
            .getPropertyValue('--fg-color')
            .trim() || '#e9e9e9',
        cursor: '#78bae9'
      }
    })
  )
  terminal.loadAddon(fitAddon)
  terminal.open(xtermEl.value)
  fitAddon.fit()

  // Intercept Shift+Enter → insert literal newline instead of submit.
  // Also Alt+Enter and Ctrl+Enter for keyboards that send those to the
  // terminal as just '\r' without a modifier.
  terminal.attachCustomKeyEventHandler((event) => {
    if (event.type === 'keydown' && event.key === 'Enter') {
      if (event.shiftKey || event.altKey) {
        readline?.newline()
        return false // swallow
      }
    }
    return true
  })

  readline = useXtermReadline(terminal, {
    onSubmit: handleSubmit
  })

  // Replay any persisted messages BEFORE showing the prompt, so the
  // scrollback reads top-to-bottom: history, then a fresh prompt.
  replayHistory()
  readline.showPrompt()
  // Trap keyboard input immediately so global Comfy hotkeys don't swallow
  // the user's first keystrokes before they click inside the terminal.
  terminal.focus()

  // Dispose any leftover hooks from a previous open before re-binding.
  stopSessionHooks?.()
  stopSessionHooks = bindSessionHooks()

  const fit = debounce(() => fitAddon?.fit(), 40)
  resizeObserver = new ResizeObserver(fit)
  if (terminalHost.value) resizeObserver.observe(terminalHost.value)
}

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

// Re-init terminal whenever the panel becomes visible (v-if on root
// re-mounts the tree so terminal/readline need to be re-created).
watch(
  () => store.isOpen,
  (open) => {
    if (!open) {
      // Tear down so next open re-initializes on the fresh DOM.
      stopSessionHooks?.()
      stopSessionHooks = null
      resizeObserver?.disconnect()
      resizeObserver = null
      readline?.dispose()
      readline = null
      terminal?.dispose()
      terminal = null
      fitAddon = null
      return
    }
    // Wait for DOM render, then for layout via rAF.
    void nextTick(() => {
      setDefaultPosition()
      void nextTick(() => {
        requestAnimationFrame(() => initTerminal())
      })
    })
  },
  { immediate: true }
)

onUnmounted(() => {
  stopSessionHooks?.()
  stopSessionHooks = null
  resizeObserver?.disconnect()
  readline?.dispose()
  terminal?.dispose()
})
</script>

<style scoped>
.terminal-host :deep(.xterm) {
  padding: 0;
}
.terminal-host :deep(.xterm .xterm-viewport) {
  background-color: transparent;
}
</style>
