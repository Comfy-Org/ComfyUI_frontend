<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch
} from 'vue'

import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

import type { CrdtLogLevel } from './crdtDebugGate'
import {
  CRDT_LOG_LEVELS,
  crdtLogLevel,
  setCrdtDebugEnabled,
  setCrdtLogLevel
} from './crdtDebugGate'
import type { CrdtDebugSnapshot, ReportSources } from './crdtDebugReport'
import {
  DEFAULT_REPORT_SOURCES,
  collectCrdtDebugReport
} from './crdtDebugReport'
import type { CrdtLogScope, DevEvent, DevEventKind } from './devPanelLog'
import { clearDevEvents, devEvents, stringifyDevEvents } from './devPanelLog'
import type { MergeScenario, MergeSimulation } from './mergeScenarios'
import { MERGE_SCENARIOS, runScenario } from './mergeScenarios'
import type { MergeTraceEntry, NodeLifecycleRow } from './mergeTrace'
import { MERGE_VOCABULARY, groupByRegister, nodeLifecycle } from './mergeTrace'
import type { AgentCrdtStatus } from './useAgentCrdtFollower'

/**
 * The CRDT debug instrument.
 *
 * Rendered into `AgentPanel`'s `#instrument` slot, as a real child of its flex
 * column directly above the composer — NOT as an overlay. The predecessor was
 * `fixed right-3 bottom-3` and sat on the composer's submit button, and its
 * status strip was a block element that pushed the composer below the fold.
 *
 * Being a flex sibling is what makes that unrepeatable: the composer is
 * `shrink-0`, so it claims its intrinsic height before this element is
 * offered any, and the conversation area above absorbs the difference. An
 * overlay bounded by a percentage of the panel cannot make that promise —
 * the composer's height is fixed in pixels, so any percentage reservation
 * fails below some viewport, silently, on exactly the laptops testers use.
 *
 * The OUTER wrapper carries `max-h-1/2` + `min-h-0` and must not be
 * `shrink-0`. Both halves are load-bearing and were each wrong once: a
 * percentage max-height resolves against the parent, so putting it on the
 * inner sheet measured it against this auto-height wrapper and capped
 * nothing; and a flex item defaults to `min-height: auto`, so without
 * `min-h-0` the wrapper refuses to shrink below its content and pushes the
 * composer out of the clipped column — the original bug, reintroduced.
 */

const { status, snapshot } = defineProps<{
  status: AgentCrdtStatus
  /** Reads the follower's live document state; see useAgentCrdtFollower. */
  snapshot?: () => CrdtDebugSnapshot
}>()

// Script-side strings: this is a dev instrument, deliberately kept out of
// src/locales so it cannot leak into the product's translation surface.
const S = {
  title: 'CRDT debug',
  close: 'Close',
  hide: 'Hide until re-enabled',
  open: 'Open CRDT debug panel',
  tabStatus: 'Status',
  tabLog: 'Log',
  tabMerge: 'Merge lab',
  none: '—',
  yes: 'yes',
  no: 'no',
  allScopes: 'all layers',
  allLevels: 'all levels',
  allKinds: 'all kinds',
  clear: 'Clear',
  copyLog: 'Copy log',
  copyReport: 'Copy full report',
  copying: 'Collecting…',
  copied: 'Copied',
  copyFailed: 'Copy failed',
  events: 'events',
  sectionDoc: 'Document',
  sectionFollower: 'Follower',
  sectionProxy: 'Backend',
  sectionVocab: 'What the words mean',
  sectionOutcome: 'Result after the whole sequence',
  sectionByRegister: 'Grouped by contested register',
  sectionLifecycle: 'Node lifecycle',
  run: 'Run sequence',
  question: 'Question',
  notePrompt:
    'Does this feel wrong? Describe the rule you would rather have. It is included verbatim in the copied report.',
  notePlaceholder:
    'e.g. "re-adding a node should restore the widget edit made while it was deleted"',
  survivingNodes: 'nodes left',
  survivingWidgets: 'widget values left',
  verbosity: 'console',
  sectionInclude: 'Also include in the report (off by default)',
  includeLogs: 'Server logs',
  includeSettings: 'Settings',
  includeWorkflow: 'Workflow JSON',
  includeHint:
    'These can carry prompts, file paths and API keys. Read the report before pasting it anywhere.'
} as const

const REPORT_SOURCE_LABELS: readonly {
  key: keyof ReportSources
  label: string
}[] = [
  { key: 'serverLogs', label: S.includeLogs },
  { key: 'settings', label: S.includeSettings },
  { key: 'workflow', label: S.includeWorkflow }
]

const STATUS_ROWS = [
  ['doc id', () => status.workflowId ?? S.none],
  ['connected', () => (status.connected ? S.yes : S.no)],
  ['updates applied', () => String(status.updatesApplied)],
  ['last frame', () => status.lastFrameType ?? S.none]
] as const

const SCOPES: readonly CrdtLogScope[] = ['wire', 'doc', 'ecs', 'ops']

const EVENT_KINDS: readonly DevEventKind[] = [
  'ws_out',
  'doc_subscribed',
  'doc_update',
  'doc_ops_result',
  'doc_reset',
  'doc_gap',
  'doc_effects',
  'doc_nodes_changed',
  'schema_error',
  'reconnected',
  'subscribe_retry',
  'stale_probe',
  'rebind',
  'op_minted',
  'op_batch_settled',
  'send_dropped'
]

const VERDICT_TONE: Record<string, string> = {
  applied: 'text-agent-success border-agent-success',
  'lww-dropped': 'text-agent-fg-muted border-agent-border-strong',
  'no-op': 'text-agent-fg-muted border-agent-border-strong',
  rejected: 'text-agent-danger border-agent-danger',
  'not-reached': 'text-agent-fg-muted border-agent-border'
}

// ── open/close state, persisted ───────────────────────────────────────────
const OPEN_KEY = 'Comfy.Agent.CrdtDevPanel.open'

const open = ref(readOpen())
const tab = ref<'status' | 'log' | 'merge'>('status')
// The mount gate is read once at panel setup, so hiding must also be local —
// otherwise "hide" leaves the chip on screen until the next reload.
const dismissed = ref(false)

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === 'true'
  } catch {
    return false
  }
}

function setOpen(value: boolean) {
  open.value = value
  if (value) void nextTick(poll)
  try {
    localStorage.setItem(OPEN_KEY, String(value))
  } catch {
    // Storage unavailable — the panel still toggles in-memory.
  }
}

// ── live document facts ───────────────────────────────────────────────────
const docState = shallowRef<CrdtDebugSnapshot | null>(null)
let pollHandle: ReturnType<typeof setInterval> | undefined

function poll() {
  if (!open.value || tab.value !== 'status') return
  docState.value = snapshot?.() ?? null
}

onMounted(() => {
  poll()
  pollHandle = setInterval(poll, 1000)
})

onBeforeUnmount(() => {
  if (pollHandle !== undefined) clearInterval(pollHandle)
})

watch(tab, poll)

const docRows = computed<readonly (readonly [string, string])[]>(() => {
  const state = docState.value
  if (!state) return [['document', S.none]] as const
  return [
    ['schema error', state.schemaError ?? S.none],
    ['last seq', state.lastSeq === null ? S.none : String(state.lastSeq)],
    ['tab id', state.tabId ?? S.none],
    ['nodes', `${state.nodeIds.length}: ${state.nodeIds.join(', ') || S.none}`],
    ['links', String(state.linkIds.length)],
    ['applied op ids', String(state.appliedOpIds.length)],
    ['stamped registers', String(Object.keys(state.stamps).length)]
  ] as const
})

// ── event log ─────────────────────────────────────────────────────────────
const scopeFilter = ref<'' | CrdtLogScope>('')
const levelFilter = ref<'' | CrdtLogLevel>('')
const kindFilter = ref<'' | DevEventKind>('')
const expanded = ref<number | null>(null)

const matchingEvents = computed<readonly DevEvent[]>(() =>
  devEvents.value.filter(
    (event) =>
      (!scopeFilter.value || event.scope === scopeFilter.value) &&
      (!levelFilter.value || event.level === levelFilter.value) &&
      (!kindFilter.value || event.kind === kindFilter.value)
  )
)

// Newest first, capped for render cost — the copy actions use the full set.
const visibleEvents = computed(() =>
  [...matchingEvents.value].reverse().slice(0, 150)
)

const level = ref<CrdtLogLevel>(crdtLogLevel())

function onLevelChange(next: CrdtLogLevel) {
  level.value = next
  setCrdtLogLevel(next)
}

// ── merge lab ─────────────────────────────────────────────────────────────
const scenario = shallowRef<MergeScenario>(MERGE_SCENARIOS[0])
const simulation = shallowRef<MergeSimulation | null>(null)
const testerNote = ref('')

function selectScenario(id: string) {
  const next = MERGE_SCENARIOS.find((candidate) => candidate.id === id)
  if (!next) return
  scenario.value = next
  simulation.value = null
}

function run() {
  simulation.value = runScenario(scenario.value)
}

const registerGroups = computed(() =>
  simulation.value ? groupByRegister(simulation.value.entries) : []
)

const lifecycle = computed(() =>
  simulation.value ? nodeLifecycle(simulation.value.entries) : []
)

function registerLine(entry: MergeTraceEntry): string {
  return `${entry.registerLabel} · stamp v${entry.stamp[0]}`
}

function lifecycleLine(row: NodeLifecycleRow): string {
  return `node ${row.nodeId} #${row.incarnation} · ${row.entry.kind} · ${verdictLabel(row.entry)}`
}

function verdictLabel(entry: MergeTraceEntry): string {
  const verdict = entry.verdict
  if (verdict.kind === 'no-op') return `no-op · ${verdict.because}`
  if (verdict.kind === 'rejected') return `rejected · ${verdict.code}`
  return verdict.kind
}

// ── copy actions ──────────────────────────────────────────────────────────
const copyState = ref<'idle' | 'busy' | 'done' | 'failed'>('idle')
const reportSources = ref<ReportSources>({ ...DEFAULT_REPORT_SOURCES })

const copyReportLabel = computed(() => {
  if (copyState.value === 'busy') return S.copying
  if (copyState.value === 'done') return S.copied
  if (copyState.value === 'failed') return S.copyFailed
  return S.copyReport
})

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Non-secure context or denied permission: fall back to a selection copy,
    // which is the only path that works over plain http on a LAN address.
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      textarea.remove()
    }
  }
}

function flashCopyState(ok: boolean) {
  copyState.value = ok ? 'done' : 'failed'
  setTimeout(() => (copyState.value = 'idle'), 1600)
}

async function copyLog() {
  flashCopyState(await writeClipboard(stringifyDevEvents(matchingEvents.value)))
}

async function copyReport() {
  copyState.value = 'busy'
  try {
    const report = await collectCrdtDebugReport({
      crdt: snapshot?.() ?? docState.value ?? fallbackSnapshot(),
      events: devEvents.value,
      testerNote: testerNote.value,
      mergeTrace: simulation.value?.entries,
      sources: reportSources.value,
      workflow: reportSources.value.workflow
        ? serializeActiveWorkflow()
        : undefined
    })
    flashCopyState(await writeClipboard(report))
  } catch {
    flashCopyState(false)
  }
}

function fallbackSnapshot(): CrdtDebugSnapshot {
  return {
    status,
    tabId: null,
    lastSeq: null,
    schemaError: null,
    meta: {},
    nodeIds: [],
    linkIds: [],
    appliedOpIds: [],
    stamps: {}
  }
}

function serializeActiveWorkflow(): unknown {
  try {
    return app.rootGraph.serialize()
  } catch (error) {
    return { error: String(error) }
  }
}

function dismiss() {
  setCrdtDebugEnabled(false)
  setOpen(false)
  dismissed.value = true
}

const proxyTarget = computed(() => api.apiURL(''))

const chipLabel = computed(
  () => `CRDT ${status.connected ? 'live' : 'off'} · ${status.updatesApplied}`
)

function fmtDetail(detail: unknown, limit = 400): string {
  try {
    const raw = JSON.stringify(detail, (_key, value) =>
      value instanceof Uint8Array ? `Uint8Array(${value.length})` : value
    )
    if (raw === undefined) return ''
    return raw.length > limit ? `${raw.slice(0, limit)}…` : raw
  } catch {
    return String(detail)
  }
}

function eventDetail(event: DevEvent): string {
  return expanded.value === event.seq
    ? fmtDetail(event.detail, 20_000)
    : fmtDetail(event.detail)
}

function fmtTime(at: number): string {
  return new Date(at).toLocaleTimeString()
}
</script>

<template>
  <div
    v-if="!dismissed"
    class="relative flex max-h-[50%] min-h-0 flex-col font-mono text-xs"
  >
    <button
      v-if="!open"
      type="button"
      :title="S.open"
      class="text-agent-fg-muted border-agent-border bg-agent-surface-raised hover:text-agent-fg hover:bg-agent-surface-hover absolute right-4 bottom-1 z-10 flex h-6 cursor-pointer items-center gap-1 rounded-full border px-2 transition-colors"
      data-testid="crdt-dev-panel-chip"
      @click="setOpen(true)"
    >
      <span
        :class="
          cn(
            'size-1.5 rounded-full',
            status.connected ? 'bg-agent-success' : 'bg-agent-danger'
          )
        "
      />
      {{ chipLabel }}
    </button>

    <section
      v-else
      class="bg-agent-surface border-agent-border text-agent-fg flex min-h-0 grow flex-col overflow-hidden border-y"
      data-testid="crdt-dev-panel"
    >
      <header
        class="border-agent-border flex h-8 shrink-0 items-center gap-2 border-b px-2"
      >
        <span class="font-bold">{{ S.title }}</span>
        <label class="text-agent-fg-muted ml-auto flex items-center gap-1">
          {{ S.verbosity }}
          <select
            v-model="level"
            class="border-agent-border bg-agent-surface-raised rounded-sm border px-1 py-0.5"
            data-testid="crdt-dev-panel-verbosity"
            @change="onLevelChange(level)"
          >
            <option
              v-for="option in CRDT_LOG_LEVELS"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>
        </label>
        <button
          type="button"
          :title="S.hide"
          class="text-agent-fg-muted hover:text-agent-danger cursor-pointer"
          data-testid="crdt-dev-panel-dismiss"
          @click="dismiss"
        >
          <span class="icon-[lucide--eye-off] size-4" />
        </button>
        <button
          type="button"
          :title="S.close"
          class="text-agent-fg-muted hover:text-agent-fg cursor-pointer"
          data-testid="crdt-dev-panel-close"
          @click="setOpen(false)"
        >
          <span class="icon-[lucide--x] size-4" />
        </button>
      </header>

      <nav class="border-agent-border flex shrink-0 border-b">
        <button
          v-for="entry in [
            ['status', S.tabStatus],
            ['log', S.tabLog],
            ['merge', S.tabMerge]
          ] as const"
          :key="entry[0]"
          type="button"
          :class="
            cn(
              'flex-1 cursor-pointer px-2 py-1 transition-colors',
              tab === entry[0]
                ? 'text-agent-fg border-agent-accent border-b-2'
                : 'text-agent-fg-muted hover:text-agent-fg'
            )
          "
          :data-testid="`crdt-dev-panel-tab-${entry[0]}`"
          @click="tab = entry[0]"
        >
          {{ entry[1] }}
        </button>
      </nav>

      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
        <template v-if="tab === 'status'">
          <section>
            <div class="text-agent-fg-muted mb-1 font-bold">
              {{ S.sectionFollower }}
            </div>
            <table class="w-full">
              <tbody>
                <tr v-for="row in STATUS_ROWS" :key="row[0]">
                  <td class="text-agent-fg-muted pr-2 align-top">
                    {{ row[0] }}
                  </td>
                  <td class="break-all">{{ row[1]() }}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <div class="text-agent-fg-muted mb-1 font-bold">
              {{ S.sectionDoc }}
            </div>
            <table class="w-full">
              <tbody>
                <tr v-for="row in docRows" :key="row[0]">
                  <td class="text-agent-fg-muted pr-2 align-top">
                    {{ row[0] }}
                  </td>
                  <td class="break-all">{{ row[1] }}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <div class="text-agent-fg-muted mb-1 font-bold">
              {{ S.sectionProxy }}
            </div>
            <div class="text-agent-fg-muted break-all">{{ proxyTarget }}</div>
          </section>
        </template>

        <template v-else-if="tab === 'log'">
          <div class="flex flex-wrap items-center gap-1">
            <select
              v-model="scopeFilter"
              class="border-agent-border bg-agent-surface-raised rounded-sm border px-1 py-0.5"
              data-testid="crdt-dev-panel-scope-filter"
            >
              <option value="">{{ S.allScopes }}</option>
              <option v-for="scope in SCOPES" :key="scope" :value="scope">
                {{ scope }}
              </option>
            </select>
            <select
              v-model="levelFilter"
              class="border-agent-border bg-agent-surface-raised rounded-sm border px-1 py-0.5"
            >
              <option value="">{{ S.allLevels }}</option>
              <option
                v-for="option in CRDT_LOG_LEVELS"
                :key="option"
                :value="option"
              >
                {{ option }}
              </option>
            </select>
            <select
              v-model="kindFilter"
              class="border-agent-border bg-agent-surface-raised rounded-sm border px-1 py-0.5"
              data-testid="crdt-dev-panel-filter"
            >
              <option value="">{{ S.allKinds }}</option>
              <option v-for="kind in EVENT_KINDS" :key="kind" :value="kind">
                {{ kind }}
              </option>
            </select>
            <span class="text-agent-fg-muted ml-auto"
              >{{ matchingEvents.length }} {{ S.events }}</span
            >
            <button
              type="button"
              class="border-agent-border hover:bg-agent-surface-hover cursor-pointer rounded-sm border px-1.5 py-0.5"
              @click="clearDevEvents()"
            >
              {{ S.clear }}
            </button>
          </div>

          <div class="space-y-1" data-testid="crdt-dev-panel-log">
            <button
              v-for="event in visibleEvents"
              :key="event.seq"
              type="button"
              class="border-agent-border hover:bg-agent-surface-hover block w-full cursor-pointer border-b pb-1 text-left"
              @click="expanded = expanded === event.seq ? null : event.seq"
            >
              <div class="flex items-baseline gap-1">
                <span class="text-agent-fg-muted">{{ fmtTime(event.at) }}</span>
                <span
                  :class="
                    cn(
                      'border-agent-border rounded-sm border px-1',
                      event.level === 'warn' &&
                        'text-agent-danger border-agent-danger'
                    )
                  "
                  >{{ event.scope }}</span
                >
                <span class="font-bold">{{ event.kind }}</span>
              </div>
              <div
                :class="
                  cn(
                    'text-agent-fg-muted break-all',
                    expanded !== event.seq && 'line-clamp-2'
                  )
                "
              >
                {{ eventDetail(event) }}
              </div>
            </button>
          </div>
        </template>

        <template v-else>
          <select
            class="border-agent-border bg-agent-surface-raised w-full rounded-sm border p-1"
            data-testid="crdt-dev-panel-scenario"
            @change="selectScenario(($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="option in MERGE_SCENARIOS"
              :key="option.id"
              :value="option.id"
              :selected="option.id === scenario.id"
            >
              {{ option.title }}
            </option>
          </select>

          <p class="text-agent-fg-muted">
            {{ S.question }}: {{ scenario.question }}
          </p>

          <button
            type="button"
            class="border-agent-accent text-agent-fg hover:bg-agent-surface-hover w-full cursor-pointer rounded-sm border px-2 py-1"
            data-testid="crdt-dev-panel-run"
            @click="run"
          >
            {{ S.run }}
          </button>

          <template v-if="simulation">
            <ol class="space-y-2" data-testid="crdt-dev-panel-trace">
              <li
                v-for="entry in simulation.entries"
                :key="entry.index"
                class="border-agent-border border-l-2 pl-2"
              >
                <div class="flex flex-wrap items-baseline gap-1">
                  <span class="text-agent-fg-muted"
                    >{{ entry.index + 1 }}.</span
                  >
                  <span class="font-bold">{{ entry.kind }}</span>
                  <span class="text-agent-fg-muted">{{ entry.actor }}</span>
                  <span
                    :class="
                      cn(
                        'ml-auto rounded-sm border px-1',
                        VERDICT_TONE[entry.verdict.kind]
                      )
                    "
                    >{{ verdictLabel(entry) }}</span
                  >
                </div>
                <div class="text-agent-fg-muted">{{ registerLine(entry) }}</div>
                <p class="mt-0.5 mb-0">{{ entry.explanation }}</p>
              </li>
            </ol>

            <section>
              <div class="text-agent-fg-muted mb-1 font-bold">
                {{ S.sectionOutcome }}
              </div>
              <div>
                {{ simulation.survivingNodeIds.length }} {{ S.survivingNodes }}:
                {{ simulation.survivingNodeIds.join(', ') || S.none }}
              </div>
              <div class="text-agent-fg-muted break-all">
                {{ S.survivingWidgets }}:
                {{ fmtDetail(simulation.survivingWidgets) }}
              </div>
            </section>

            <section v-if="registerGroups.length">
              <div class="text-agent-fg-muted mb-1 font-bold">
                {{ S.sectionByRegister }}
              </div>
              <div v-for="group in registerGroups" :key="group.register">
                <div class="font-bold">{{ group.label }}</div>
                <div
                  v-for="entry in group.entries"
                  :key="entry.index"
                  class="text-agent-fg-muted pl-2"
                >
                  {{ entry.kind }} · {{ entry.actor }} ·
                  {{ verdictLabel(entry) }}
                </div>
              </div>
            </section>

            <section v-if="lifecycle.length">
              <div class="text-agent-fg-muted mb-1 font-bold">
                {{ S.sectionLifecycle }}
              </div>
              <div
                v-for="row in lifecycle"
                :key="`${row.nodeId}-${row.entry.index}`"
                class="text-agent-fg-muted"
              >
                {{ lifecycleLine(row) }}
              </div>
            </section>
          </template>

          <section>
            <div class="text-agent-fg-muted mb-1 font-bold">
              {{ S.sectionVocab }}
            </div>
            <dl class="space-y-1">
              <div v-for="item in MERGE_VOCABULARY" :key="item.term">
                <dt class="font-bold">{{ item.term }}</dt>
                <dd class="text-agent-fg-muted ml-0">{{ item.meaning }}</dd>
              </div>
            </dl>
          </section>

          <section>
            <label
              for="crdt-tester-note"
              class="text-agent-fg-muted mb-1 block font-bold"
              >{{ S.notePrompt }}</label
            >
            <textarea
              id="crdt-tester-note"
              v-model="testerNote"
              rows="3"
              :placeholder="S.notePlaceholder"
              class="border-agent-border bg-agent-surface-raised text-agent-fg w-full rounded-sm border p-1"
              data-testid="crdt-dev-panel-note"
            />
          </section>
        </template>
      </div>

      <footer class="border-agent-border shrink-0 border-t p-2">
        <div class="text-agent-fg-muted mb-1">{{ S.sectionInclude }}</div>
        <div class="mb-1 flex flex-wrap gap-x-3 gap-y-1">
          <label
            v-for="source in REPORT_SOURCE_LABELS"
            :key="source.key"
            class="flex cursor-pointer items-center gap-1"
          >
            <input
              v-model="reportSources[source.key]"
              type="checkbox"
              :data-testid="`crdt-dev-panel-include-${source.key}`"
            />
            {{ source.label }}
          </label>
        </div>
        <p class="text-agent-fg-muted mt-0 mb-2">{{ S.includeHint }}</p>
        <div class="flex gap-1">
          <button
            type="button"
            class="border-agent-border hover:bg-agent-surface-hover flex-1 cursor-pointer rounded-sm border px-2 py-1"
            @click="copyLog"
          >
            {{ S.copyLog }}
          </button>
          <button
            type="button"
            :disabled="copyState === 'busy'"
            class="border-agent-accent hover:bg-agent-surface-hover flex-2 cursor-pointer rounded-sm border px-2 py-1 disabled:cursor-default"
            data-testid="crdt-dev-panel-copy-report"
            @click="copyReport"
          >
            {{ copyReportLabel }}
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>
