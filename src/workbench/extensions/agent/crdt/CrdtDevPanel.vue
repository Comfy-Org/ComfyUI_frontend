<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { api } from '@/scripts/api'

import type { AgentCrdtStatus } from './useAgentCrdtFollower'
import type { DevEvent, DevEventKind } from './devPanelLog'
import { clearDevEvents, devEvents, stringifyDevEvents } from './devPanelLog'

/**
 * Dev instrumentation: CRDT debugging overlay. Surfaces the follower's live
 * state, the dev event ring buffer, the mutation catalog and known-good agent
 * prompts so QA never has to reverse-engineer the console helpers. Reads
 * `window.__agentCrdtPoc` (installed by useAgentCrdtFollower under
 * import.meta.env.DEV) on a 1s poll, zero extra API surface on the
 * composable. Has no mount site until the agent-panel slice lands; removable
 * once real status UI ships.
 */

const props = defineProps<{ status: AgentCrdtStatus }>()

const isDevBuild = import.meta.env.DEV

// ── strings (dev-only debug surface, intentionally untranslated) ──────────
const S = {
  chipClosed: 'CRDT dev',
  title: 'CRDT Dev Panel (PoC)',
  close: 'Close',
  sectionStatus: 'Live status',
  sectionCatalog: 'Mutation catalog',
  sectionPrompts: 'Known-good agent prompts',
  sectionProxy: 'BE proxy target',
  sectionLog: 'Event log',
  docId: 'doc id',
  connected: 'connected',
  yes: 'yes',
  no: 'no',
  none: '—',
  updates: 'updates applied',
  lastFrame: 'last frame',
  tabId: 'tab id',
  lastSeq: 'last seq',
  remints: 'remints (doc_reset)',
  nodesAdded: 'doc nodes added',
  nodesRemoved: 'doc nodes removed',
  filterAll: 'all kinds',
  clear: 'Clear',
  copyJson: 'Copy JSON',
  copied: 'Copied',
  eventCount: 'events'
} as const

const MUTATION_CATALOG = [
  'add_node',
  'delete_node',
  'move_node',
  'set_widget',
  'connect',
  'disconnect'
] as const

const KNOWN_GOOD_PROMPTS = [
  "Add a single CLIP Text Encode (Prompt) node with text 'hello world'",
  'Add a KSampler node',
  'Delete the newest node you added'
] as const

const EVENT_KINDS: readonly DevEventKind[] = [
  'ws_out',
  'doc_subscribed',
  'doc_update',
  'doc_ops_result',
  'doc_reset',
  'schema_error',
  'reconnected',
  'subscribe_retry',
  'doc_nodes_changed',
  'rebind'
] as const

// ── open/close state, persisted ───────────────────────────────────────────
const OPEN_KEY = 'Comfy.Agent.CrdtDevPanel.open'

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === 'true'
  } catch {
    return false
  }
}

const open = ref(isDevBuild && readOpen())

function setOpen(value: boolean) {
  open.value = value
  try {
    localStorage.setItem(OPEN_KEY, String(value))
  } catch {
    /* storage unavailable — panel still toggles in-memory */
  }
}

// ── 1s poll of the PoC console helper ─────────────────────────────────────
interface PocGlobal {
  tabId?: string
  lastSeq?: number
}

const polled = ref<{ tabId: string | null; lastSeq: number | null }>({
  tabId: null,
  lastSeq: null
})

let pollHandle: ReturnType<typeof setInterval> | undefined

function poll() {
  const poc = (window as unknown as Record<string, unknown>).__agentCrdtPoc as
    | PocGlobal
    | undefined
  polled.value = {
    tabId: poc?.tabId ?? null,
    lastSeq: typeof poc?.lastSeq === 'number' ? poc.lastSeq : null
  }
}

onMounted(() => {
  if (!isDevBuild) return
  poll()
  pollHandle = setInterval(poll, 1000)
})

onBeforeUnmount(() => {
  if (pollHandle !== undefined) clearInterval(pollHandle)
})

// ── derived counters from the event buffer ────────────────────────────────
const remintCount = computed(
  () => devEvents.value.filter((e) => e.kind === 'doc_reset').length
)

const nodeDelta = computed(() => {
  let added = 0
  let removed = 0
  for (const e of devEvents.value) {
    if (e.kind !== 'doc_nodes_changed') continue
    const d = e.detail as { added?: unknown[]; removed?: unknown[] } | null
    added += d?.added?.length ?? 0
    removed += d?.removed?.length ?? 0
  }
  return { added, removed }
})

// ── event log filter / actions ────────────────────────────────────────────
const kindFilter = ref<'' | DevEventKind>('')

const filteredEvents = computed<readonly DevEvent[]>(() => {
  const events = devEvents.value
  const filtered = kindFilter.value
    ? events.filter((e) => e.kind === kindFilter.value)
    : events
  // newest first, capped for render cost — full buffer still available via copy
  return [...filtered].reverse().slice(0, 100)
})

const copyLabel = ref<string>(S.copyJson)

async function copyEvents() {
  const events = kindFilter.value
    ? devEvents.value.filter((e) => e.kind === kindFilter.value)
    : devEvents.value
  try {
    await navigator.clipboard.writeText(stringifyDevEvents(events))
    copyLabel.value = S.copied
    setTimeout(() => (copyLabel.value = S.copyJson), 1200)
  } catch {
    /* clipboard unavailable (non-secure context) — silently ignore */
  }
}

const proxyTarget = computed(() => api.apiURL(''))

function fmtDetail(detail: unknown): string {
  try {
    const raw = JSON.stringify(detail, (_k, v) =>
      v instanceof Uint8Array ? `Uint8Array(${v.length})` : v
    )
    return raw && raw.length > 200 ? raw.slice(0, 200) + '…' : (raw ?? '')
  } catch {
    return String(detail)
  }
}

function fmtTime(at: number): string {
  return new Date(at).toLocaleTimeString()
}
</script>

<template>
  <div
    v-if="isDevBuild"
    class="fixed right-3 bottom-3 z-9999 font-mono text-xs"
    data-testid="crdt-dev-panel"
  >
    <button
      v-if="!open"
      class="rounded-full border border-border-default bg-base-background px-3 py-1 shadow-md"
      data-testid="crdt-dev-panel-chip"
      @click="setOpen(true)"
    >
      {{ S.chipClosed }}
    </button>

    <div
      v-else
      class="flex max-h-[70vh] w-[420px] flex-col overflow-hidden rounded-lg border border-border-default bg-base-background shadow-xl"
    >
      <div
        class="flex items-center justify-between border-b border-border-default px-3 py-2"
      >
        <span class="font-bold">{{ S.title }}</span>
        <button
          class="rounded-sm border border-border-default px-2 py-0.5"
          data-testid="crdt-dev-panel-close"
          @click="setOpen(false)"
        >
          {{ S.close }}
        </button>
      </div>

      <div class="flex-1 space-y-3 overflow-y-auto p-3">
        <section>
          <div class="mb-1 font-bold">{{ S.sectionStatus }}</div>
          <table class="w-full">
            <tbody>
              <tr>
                <td class="pr-2 text-muted">{{ S.docId }}</td>
                <td class="break-all">
                  {{ props.status.workflowId ?? S.none }}
                </td>
              </tr>
              <tr>
                <td class="pr-2 text-muted">{{ S.connected }}</td>
                <td>{{ props.status.connected ? S.yes : S.no }}</td>
              </tr>
              <tr>
                <td class="pr-2 text-muted">{{ S.updates }}</td>
                <td>{{ props.status.updatesApplied }}</td>
              </tr>
              <tr>
                <td class="pr-2 text-muted">{{ S.lastFrame }}</td>
                <td>{{ props.status.lastFrameType ?? S.none }}</td>
              </tr>
              <tr>
                <td class="pr-2 text-muted">{{ S.tabId }}</td>
                <td class="break-all">{{ polled.tabId ?? S.none }}</td>
              </tr>
              <tr>
                <td class="pr-2 text-muted">{{ S.lastSeq }}</td>
                <td>{{ polled.lastSeq ?? S.none }}</td>
              </tr>
              <tr>
                <td class="pr-2 text-muted">{{ S.remints }}</td>
                <td>{{ remintCount }}</td>
              </tr>
              <tr>
                <td class="pr-2 text-muted">{{ S.nodesAdded }}</td>
                <td>{{ nodeDelta.added }}</td>
              </tr>
              <tr>
                <td class="pr-2 text-muted">{{ S.nodesRemoved }}</td>
                <td>{{ nodeDelta.removed }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <div class="mb-1 font-bold">{{ S.sectionProxy }}</div>
          <div class="break-all text-muted">{{ proxyTarget }}</div>
        </section>

        <section>
          <div class="mb-1 font-bold">{{ S.sectionCatalog }}</div>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="m in MUTATION_CATALOG"
              :key="m"
              class="rounded-sm border border-border-default px-1.5 py-0.5"
            >
              {{ m }}
            </span>
          </div>
        </section>

        <section>
          <div class="mb-1 font-bold">{{ S.sectionPrompts }}</div>
          <ul class="list-disc space-y-1 pl-4">
            <li v-for="p in KNOWN_GOOD_PROMPTS" :key="p">{{ p }}</li>
          </ul>
        </section>

        <section>
          <div class="mb-1 flex items-center gap-2">
            <span class="font-bold">{{ S.sectionLog }}</span>
            <span class="text-muted"
              >{{ devEvents.length }} {{ S.eventCount }}</span
            >
            <select
              v-model="kindFilter"
              class="ml-auto rounded-sm border border-border-default bg-base-background px-1 py-0.5"
              data-testid="crdt-dev-panel-filter"
            >
              <option value="">{{ S.filterAll }}</option>
              <option v-for="k in EVENT_KINDS" :key="k" :value="k">
                {{ k }}
              </option>
            </select>
            <button
              class="rounded-sm border border-border-default px-1.5 py-0.5"
              @click="copyEvents"
            >
              {{ copyLabel }}
            </button>
            <button
              class="rounded-sm border border-border-default px-1.5 py-0.5"
              @click="clearDevEvents()"
            >
              {{ S.clear }}
            </button>
          </div>
          <div
            class="max-h-56 space-y-1 overflow-y-auto"
            data-testid="crdt-dev-panel-log"
          >
            <div
              v-for="e in filteredEvents"
              :key="e.seq"
              class="border-b border-border-default pb-1"
            >
              <span class="text-muted">{{ fmtTime(e.at) }}</span>
              <span class="ml-1 font-bold">{{ e.kind }}</span>
              <div class="break-all text-muted">{{ fmtDetail(e.detail) }}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
