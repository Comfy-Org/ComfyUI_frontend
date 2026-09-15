<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useClipboard, useEventListener } from '@vueuse/core'
import type { ComponentPublicInstance } from 'vue'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import ToggleGroup from '@/components/ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '@/components/ui/toggle-group/ToggleGroupItem.vue'
import type { SelectOption } from '@/components/ui/select/types'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { resolveDeployEnv } from '@/platform/telemetry/initDatadogRum'
import { reportError } from '@/platform/telemetry/reportError'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'

import { useAgentConversationStore } from '../stores/agent/agentConversationStore'
import { CRDT_LOG_LEVELS, crdtLogLevel, setCrdtLogLevel } from './crdtDebugGate'
import type {
  CrdtDebugReportInput,
  ReportIdentifiers,
  ReportSources
} from './crdtDebugReport'
import type { CrdtDebugSnapshot } from './crdtSnapshot'
import {
  DEFAULT_REPORT_SOURCES,
  collectCrdtDebugReport
} from './crdtDebugReport'
import type { CrdtLogScope, DevEvent, DevEventKind } from './devPanelLog'
import {
  DEV_EVENT_KINDS,
  clearDevEvents,
  devEvents,
  stringifyDevEvents
} from './devPanelLog'
import type { MergeScenario, MergeSimulation } from './mergeScenarios'
import { getMergeScenarios, runScenario } from './mergeScenarios'
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

const { t } = useI18n()
const i18nKey = 'agent.crdtDevPanel'

const reportSourceLabels = computed<
  readonly { key: keyof ReportSources; label: string }[]
>(() => [
  { key: 'serverLogs', label: t(`${i18nKey}.includeLogs`) },
  { key: 'settings', label: t(`${i18nKey}.includeSettings`) },
  { key: 'workflow', label: t(`${i18nKey}.includeWorkflow`) }
])

const statusRows = computed<readonly (readonly [string, string])[]>(() => {
  const outcomes = status.outcomes
  return [
    [t(`${i18nKey}.documentId`), status.workflowId ?? t(`${i18nKey}.none`)],
    [
      t(`${i18nKey}.connected`),
      status.connected ? t(`${i18nKey}.yes`) : t(`${i18nKey}.no`)
    ],
    [t(`${i18nKey}.updatesApplied`), String(status.updatesApplied)],
    [
      t(`${i18nKey}.outcomes`),
      [
        outcomes.received,
        outcomes.applied,
        outcomes.skipped,
        outcomes.errored,
        outcomes.gap,
        outcomes.reset,
        outcomes.dropped
      ].join('/')
    ],
    [t(`${i18nKey}.lastFrame`), status.lastFrameType ?? t(`${i18nKey}.none`)]
  ]
})

const tabs = computed(() => [
  { value: 'status', label: t(`${i18nKey}.tabStatus`) },
  { value: 'log', label: t(`${i18nKey}.tabLog`) },
  { value: 'merge', label: t(`${i18nKey}.tabMerge`) }
])

function selectOptions(values: readonly string[]): SelectOption[] {
  return values.map((value) => ({ name: value, value }))
}

const verbosityOptions = selectOptions(CRDT_LOG_LEVELS)

const SCOPES: readonly CrdtLogScope[] = ['wire', 'doc']

const scopeOptions = computed(() => [
  { name: t(`${i18nKey}.allScopes`), value: 'all' },
  ...selectOptions(SCOPES)
])
const levelOptions = computed(() => [
  { name: t(`${i18nKey}.allLevels`), value: 'all' },
  ...verbosityOptions
])
const kindOptions = computed(() => [
  { name: t(`${i18nKey}.allKinds`), value: 'all' },
  ...selectOptions(DEV_EVENT_KINDS)
])

const VERDICT_TONE: Record<string, string> = {
  applied: 'text-success-background border-success-background',
  'lww-dropped': 'text-muted-foreground border-border-default',
  'no-op': 'text-muted-foreground border-border-default',
  rejected: 'text-destructive-background border-destructive-background',
  'not-reached': 'text-muted-foreground border-component-node-border'
}

// ── open/close state, persisted ───────────────────────────────────────────
const OPEN_KEY = 'Comfy.Agent.CrdtDevPanel.open'
const HIDDEN_KEY = 'Comfy.Agent.CrdtDevPanel.hidden'

const open = ref(readOpen())
const tab = ref<'status' | 'log' | 'merge'>('status')
const dismissed = ref(readHidden())
const chipButton = useTemplateRef<ComponentPublicInstance | HTMLButtonElement>(
  'chipButton'
)
const closeButton = useTemplateRef<ComponentPublicInstance | HTMLButtonElement>(
  'closeButton'
)

function focusButton(
  control: ComponentPublicInstance | HTMLButtonElement | null
): void {
  const button =
    control instanceof HTMLButtonElement
      ? control
      : control?.$el instanceof HTMLButtonElement
        ? control.$el
        : null
  button?.focus()
}

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === 'true'
  } catch {
    return false
  }
}

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === 'true'
  } catch {
    return false
  }
}

function setHidden(hidden: boolean): void {
  try {
    localStorage.setItem(HIDDEN_KEY, String(hidden))
  } catch {
    return
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

function onDocumentKeydown(event: KeyboardEvent): void {
  if (!open.value || event.key !== 'Escape') return
  event.stopPropagation()
  if (event.target instanceof HTMLSelectElement) return
  setOpen(false)
}

useEventListener(document, 'keydown', onDocumentKeydown)

// ── live document facts ───────────────────────────────────────────────────
const docState = shallowRef<CrdtDebugSnapshot | null>(null)
let pollHandle: ReturnType<typeof setInterval> | undefined
let logCopyReset: ReturnType<typeof setTimeout> | undefined
let reportCopyReset: ReturnType<typeof setTimeout> | undefined
let itemCopyReset: ReturnType<typeof setTimeout> | undefined

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
  clearTimeout(logCopyReset)
  clearTimeout(reportCopyReset)
  clearTimeout(itemCopyReset)
})

watch(
  open,
  (value) => {
    const control = value ? closeButton.value : chipButton.value
    focusButton(control)
  },
  { flush: 'post' }
)
watch(
  closeButton,
  (button) => {
    if (open.value) focusButton(button)
  },
  { flush: 'post' }
)
watch(tab, poll)

const docRows = computed<readonly (readonly [string, string])[]>(() => {
  const state = docState.value
  if (!state) return [[t(`${i18nKey}.document`), t(`${i18nKey}.none`)]] as const
  return [
    [t(`${i18nKey}.schemaError`), state.schemaError ?? t(`${i18nKey}.none`)],
    [
      t(`${i18nKey}.schemaVersion`),
      String(state.meta.schema_version ?? t(`${i18nKey}.none`))
    ],
    [
      t(`${i18nKey}.lastSequence`),
      state.lastSeq === null ? t(`${i18nKey}.none`) : String(state.lastSeq)
    ],
    [t(`${i18nKey}.tabId`), state.tabId ?? t(`${i18nKey}.none`)],
    [
      t(`${i18nKey}.nodes`),
      `${state.nodeIds.length}: ${state.nodeIds.join(', ') || t(`${i18nKey}.none`)}`
    ],
    [t(`${i18nKey}.links`), String(state.linkIds.length)],
    [t(`${i18nKey}.appliedOperationIds`), String(state.appliedOpIds.length)],
    [t(`${i18nKey}.stampedRegisters`), String(Object.keys(state.stamps).length)]
  ] as const
})

// ── event log ─────────────────────────────────────────────────────────────
const scopeFilter = ref('all')
const levelFilter = ref('all')
const kindFilter = ref('all')
const expanded = ref<number | null>(null)

const matchingEvents = computed<readonly DevEvent[]>(() =>
  devEvents.value.filter(
    (event) =>
      (scopeFilter.value === 'all' || event.scope === scopeFilter.value) &&
      (levelFilter.value === 'all' || event.level === levelFilter.value) &&
      (kindFilter.value === 'all' || event.kind === kindFilter.value)
  )
)

interface LogRow {
  event: DevEvent
  detail: string
  excerpt: string
  nodeIds: readonly string[]
}

const visibleLogRows = computed<readonly LogRow[]>(() =>
  [...matchingEvents.value]
    .reverse()
    .slice(0, 150)
    .map((event) => {
      const detail = stringifyDetail(event.detail)
      return {
        event,
        detail,
        excerpt: truncateDetail(detail),
        nodeIds: eventNodeIds(event)
      }
    })
)

const level = ref<string | undefined>(crdtLogLevel())

function onLevelChange(next: string | undefined) {
  const value = CRDT_LOG_LEVELS.find((candidate) => candidate === next)
  if (value) setCrdtLogLevel(value)
}

// ── merge lab ─────────────────────────────────────────────────────────────
const mergeScenarios = getMergeScenarios()
const scenario = shallowRef<MergeScenario>(mergeScenarios[0])
const scenarioId = ref<string | undefined>(scenario.value.id)
const scenarioOptions = mergeScenarios.map(({ id, title }) => ({
  name: title,
  value: id
}))
const simulation = shallowRef<MergeSimulation | null>(null)
const NOTE_KEY = 'Comfy.Agent.CrdtDevPanel.note'

function readNote(): string {
  try {
    return localStorage.getItem(NOTE_KEY) ?? ''
  } catch {
    return ''
  }
}

const testerNote = ref(readNote())

watch(testerNote, (next) => {
  try {
    localStorage.setItem(NOTE_KEY, next)
  } catch {
    // Storage unavailable — the note simply does not survive a remount.
  }
})

function selectScenario(id: string | undefined) {
  if (!id) return
  const next = mergeScenarios.find((candidate) => candidate.id === id)
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
  return t(`${i18nKey}.registerStamp`, {
    register: entry.registerLabel,
    version: entry.stamp[0]
  })
}

function lifecycleLine(row: NodeLifecycleRow): string {
  return t(`${i18nKey}.lifecycleLine`, {
    nodeId: row.nodeId,
    incarnation: row.incarnation,
    kind: row.entry.kind,
    verdict: verdictLabel(row.entry)
  })
}

function verdictLabel(entry: MergeTraceEntry): string {
  const verdict = entry.verdict
  if (verdict.kind === 'no-op') return `no-op · ${verdict.because}`
  if (verdict.kind === 'rejected') return `rejected · ${verdict.code}`
  return verdict.kind
}

// ── copy actions ──────────────────────────────────────────────────────────
type CopyState = 'idle' | 'busy' | 'done' | 'failed'
const logCopyState = ref<CopyState>('idle')
const reportCopyState = ref<
  | { status: 'idle' | 'busy' | 'done' }
  | { status: 'failed'; report: string | null }
>({ status: 'idle' })
const itemCopy = ref<{ key: string; state: 'done' | 'failed' } | null>(null)
const reportSources = ref<ReportSources>({ ...DEFAULT_REPORT_SOURCES })
const { copy } = useClipboard({ legacy: true })

const copyReportLabel = computed(() => {
  if (reportCopyState.value.status === 'busy') return t(`${i18nKey}.copying`)
  if (reportCopyState.value.status === 'done') return t(`${i18nKey}.copied`)
  if (reportCopyState.value.status === 'failed')
    return t('agent.diagnosticReport.retry')
  return t(`${i18nKey}.copyReport`)
})

const copyLogLabel = computed(() => {
  if (logCopyState.value === 'done') return t(`${i18nKey}.copied`)
  if (logCopyState.value === 'failed') return t(`${i18nKey}.copyFailed`)
  return t(`${i18nKey}.copyLog`)
})

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await copy(text)
    return true
  } catch {
    return false
  }
}

async function copyItem(key: string, text: string) {
  const ok = await writeClipboard(text)
  itemCopy.value = { key, state: ok ? 'done' : 'failed' }
  clearTimeout(itemCopyReset)
  itemCopyReset = setTimeout(() => (itemCopy.value = null), 1600)
}

function itemCopyLabel(
  key: string,
  idle: string = t(`${i18nKey}.copy`)
): string {
  if (itemCopy.value?.key !== key) return idle
  return itemCopy.value.state === 'done'
    ? t(`${i18nKey}.copied`)
    : t(`${i18nKey}.copyFailed`)
}

function flashLogCopyState(ok: boolean) {
  clearTimeout(logCopyReset)
  logCopyState.value = ok ? 'done' : 'failed'
  logCopyReset = setTimeout(() => (logCopyState.value = 'idle'), 1600)
}

async function copyLog() {
  try {
    flashLogCopyState(
      await writeClipboard(stringifyDevEvents(matchingEvents.value))
    )
  } catch {
    flashLogCopyState(false)
  }
}

async function copyReport() {
  clearTimeout(reportCopyReset)
  const retainedReport =
    reportCopyState.value.status === 'failed'
      ? reportCopyState.value.report
      : null
  reportCopyState.value = { status: 'busy' }
  if (retainedReport !== null) {
    await copyCollectedReport(retainedReport)
    return
  }
  try {
    const crdt = snapshot?.() ?? docState.value ?? fallbackSnapshot()
    const report = await collectCrdtDebugReport({
      crdt,
      events: devEvents.value,
      agentMessages: useAgentConversationStore().messages,
      identifiers: collectIdentifiers(crdt),
      testerNote: testerNote.value,
      mergeTrace: simulation.value?.entries,
      sources: reportSources.value,
      ...(reportSources.value.workflow ? serializeActiveWorkflow() : {})
    })
    await copyCollectedReport(report)
  } catch (error) {
    reportError(error, { errorType: 'crdt_dev_panel_report_copy_failed' })
    reportCopyState.value = { status: 'failed', report: null }
  }
}

async function copyCollectedReport(report: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(report)
  } catch {
    reportCopyState.value = { status: 'failed', report }
    return
  }
  reportCopyState.value = { status: 'done' }
  reportCopyReset = setTimeout(
    () => (reportCopyState.value = { status: 'idle' }),
    1600
  )
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

function serializeActiveWorkflow(): Pick<
  CrdtDebugReportInput,
  'workflow' | 'workflowError'
> {
  try {
    return { workflow: app.rootGraph.serialize() }
  } catch (error) {
    return { workflowError: String(error) }
  }
}

/**
 * The IDs a backend engineer needs to find this session in Datadog/logs —
 * see {@link ReportIdentifiers}. Collected here rather than inside
 * `crdtDebugReport.ts` because every value lives behind a Pinia store or
 * composable, and that module deliberately stays framework-store-free.
 *
 * Per-field try/catch, not one wrapping try/catch: a store that throws
 * (uninitialized outside a real app mount, e.g. in a test) must not blank
 * out the eight other identifiers that read fine — the same fault-isolation
 * principle `attempt()` uses for the async sources in crdtDebugReport.ts.
 */
function collectIdentifiers(crdt: CrdtDebugSnapshot): ReportIdentifiers {
  const read = <T>(get: () => T): T | null => {
    try {
      return get()
    } catch {
      return null
    }
  }

  const recentJobIds =
    read(() => {
      const queueStore = useQueueStore()
      return [
        ...queueStore.runningTasks,
        ...queueStore.pendingTasks,
        ...queueStore.historyTasks
      ].map((task) => task.jobId)
    }) ?? []

  const conversation = read(() => useAgentConversationStore())
  const recentAgentTurnIds = conversation
    ? [...new Set(conversation.messages.map((message) => message.id))]
        .reverse()
        .slice(0, 10)
    : []
  const crdtLamport = Object.values(crdt.stamps).reduce<number | null>(
    (highest, stamp) => {
      const counter = Array.isArray(stamp) ? stamp[0] : undefined
      if (typeof counter !== 'number') return highest
      return highest === null ? counter : Math.max(highest, counter)
    },
    null
  )
  const activeWorkflow = read(() => useWorkflowStore().activeWorkflow)

  return {
    userId: read(() => useCurrentUser().resolvedUserInfo.value?.id ?? null),
    organizationId: null,
    workspaceId: read(() => useTeamWorkspaceStore().activeWorkspaceId ?? null),
    agentThreadId: conversation?.threadId ?? null,
    activeAgentTurnId: conversation?.activeTurnId ?? null,
    recentAgentTurnIds,
    tabId: crdt.tabId,
    activeJobId: read(() => useExecutionStore().activeJobId ?? null),
    recentJobIds,
    workflowPath: activeWorkflow?.path ?? null,
    workflowId: crdt.status.workflowId ?? null,
    graphId: activeWorkflow?.activeState?.id ?? null,
    docId: crdt.status.workflowId ?? null,
    crdtSequence: crdt.lastSeq,
    crdtLamport,
    clientId: read(() => api.clientId ?? null),
    deployEnv: read(() => resolveDeployEnv() ?? null),
    backendUrl: read(() => `${api.api_host}${api.api_base}`) ?? 'unknown'
  }
}

function dismiss() {
  setOpen(false)
  dismissed.value = true
  setHidden(true)
}

function restore() {
  dismissed.value = false
  setHidden(false)
}

const proxyTarget = computed(() => api.apiURL(''))

const chipLabel = computed(() =>
  t(`${i18nKey}.chip`, {
    status: status.connected ? t(`${i18nKey}.live`) : t(`${i18nKey}.off`),
    count: status.updatesApplied
  })
)

function stringifyDetail(detail: unknown): string {
  try {
    const raw = JSON.stringify(detail, (_key, value) =>
      value instanceof Uint8Array ? `Uint8Array(${value.length})` : value
    )
    return raw ?? ''
  } catch {
    return String(detail)
  }
}

function truncateDetail(detail: string, limit = 200): string {
  return detail.length > limit ? `${detail.slice(0, limit)}…` : detail
}

function eventNodeIds(event: DevEvent): string[] {
  if (event.kind !== 'doc_nodes_changed') return []
  const detail = event.detail as {
    added?: unknown[]
    removed?: unknown[]
  } | null
  return [...(detail?.added ?? []), ...(detail?.removed ?? [])].filter(
    (id): id is string => typeof id === 'string'
  )
}

function fmtTime(at: number): string {
  return new Date(at).toLocaleTimeString()
}
</script>

<template>
  <div class="relative flex max-h-1/2 min-h-0 flex-col font-mono text-xs">
    <Button
      v-if="dismissed"
      variant="outline"
      size="sm"
      :title="t(`${i18nKey}.restore`)"
      class="mr-4 mb-1 self-end rounded-full"
      data-testid="crdt-dev-panel-restore"
      @click="restore"
    >
      <span class="icon-[lucide--eye] size-3" />
      {{ t(`${i18nKey}.restore`) }}
    </Button>

    <Button
      v-else-if="!open"
      ref="chipButton"
      variant="outline"
      size="sm"
      :title="t(`${i18nKey}.open`)"
      class="mr-4 mb-1 self-end rounded-full"
      data-testid="crdt-dev-panel-chip"
      @click="setOpen(true)"
    >
      <span
        :class="
          cn(
            'size-1.5 rounded-full',
            status.connected
              ? 'bg-success-background'
              : 'bg-destructive-background'
          )
        "
      />
      {{ chipLabel }}
    </Button>

    <section
      v-else
      class="flex min-h-0 grow flex-col overflow-hidden border-y border-component-node-border bg-base-background text-base-foreground"
      data-testid="crdt-dev-panel"
    >
      <header
        class="flex h-10 shrink-0 items-center gap-2 border-b border-component-node-border px-2"
      >
        <span class="font-bold">{{ t(`${i18nKey}.title`) }}</span>
        <label class="ml-auto flex items-center gap-1 text-muted-foreground">
          {{ t(`${i18nKey}.verbosity`) }}
          <SingleSelect
            v-model="level"
            :label="t(`${i18nKey}.verbosity`)"
            :options="verbosityOptions"
            size="md"
            class="w-24"
            data-testid="crdt-dev-panel-verbosity"
            @update:model-value="onLevelChange"
          />
        </label>
        <Button
          variant="destructive-textonly"
          size="icon-sm"
          :title="t(`${i18nKey}.hide`)"
          :aria-label="t(`${i18nKey}.hide`)"
          data-testid="crdt-dev-panel-dismiss"
          @click="dismiss"
        >
          <span class="icon-[lucide--eye-off] size-4" />
        </Button>
        <Button
          ref="closeButton"
          variant="muted-textonly"
          size="icon-sm"
          :title="t(`${i18nKey}.close`)"
          :aria-label="t(`${i18nKey}.close`)"
          data-testid="crdt-dev-panel-close"
          @click="setOpen(false)"
        >
          <span class="icon-[lucide--x] size-4" />
        </Button>
      </header>

      <ToggleGroup
        v-model="tab"
        type="single"
        class="shrink-0 border-b border-component-node-border p-1"
        :aria-label="t(`${i18nKey}.tabs`)"
      >
        <ToggleGroupItem
          v-for="entry in tabs"
          :key="entry.value"
          :value="entry.value"
          size="sm"
          :data-testid="`crdt-dev-panel-tab-${entry.value}`"
        >
          {{ entry.label }}
        </ToggleGroupItem>
      </ToggleGroup>

      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
        <template v-if="tab === 'status'">
          <section>
            <div class="mb-1 font-bold text-muted-foreground">
              {{ t(`${i18nKey}.sectionFollower`) }}
            </div>
            <table class="w-full table-fixed">
              <tbody>
                <tr v-for="row in statusRows" :key="row[0]">
                  <td
                    class="w-1/2 pr-2 align-top wrap-break-word text-muted-foreground"
                  >
                    {{ row[0] }}
                  </td>
                  <td class="break-all">
                    {{ row[1] }}
                    <Button
                      v-if="
                        row[0] === t(`${i18nKey}.documentId`) &&
                        status.workflowId
                      "
                      variant="outline"
                      size="sm"
                      class="ml-1"
                      :aria-label="t(`${i18nKey}.copyDocumentId`)"
                      @click="
                        copyItem(`doc:${status.workflowId}`, status.workflowId)
                      "
                    >
                      {{ itemCopyLabel(`doc:${status.workflowId}`) }}
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <div class="mb-1 font-bold text-muted-foreground">
              {{ t(`${i18nKey}.sectionDoc`) }}
            </div>
            <table class="w-full">
              <tbody>
                <tr v-for="row in docRows" :key="row[0]">
                  <td class="pr-2 align-top text-muted-foreground">
                    {{ row[0] }}
                  </td>
                  <td class="break-all">{{ row[1] }}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <div class="mb-1 font-bold text-muted-foreground">
              {{ t(`${i18nKey}.sectionProxy`) }}
            </div>
            <div class="break-all text-muted-foreground">{{ proxyTarget }}</div>
          </section>
        </template>

        <template v-else-if="tab === 'log'">
          <div class="flex flex-wrap items-center gap-1">
            <SingleSelect
              v-model="scopeFilter"
              :label="t(`${i18nKey}.scopeFilter`)"
              :options="scopeOptions"
              size="md"
              class="w-28"
              data-testid="crdt-dev-panel-scope-filter"
            />
            <SingleSelect
              v-model="levelFilter"
              :label="t(`${i18nKey}.levelFilter`)"
              :options="levelOptions"
              size="md"
              class="w-28"
              data-testid="crdt-dev-panel-level-filter"
            />
            <SingleSelect
              v-model="kindFilter"
              :label="t(`${i18nKey}.kindFilter`)"
              :options="kindOptions"
              size="md"
              class="min-w-32 flex-1"
              data-testid="crdt-dev-panel-filter"
            />
            <span class="ml-auto text-muted-foreground">{{
              t(`${i18nKey}.eventCount`, matchingEvents.length)
            }}</span>
            <Button variant="outline" size="sm" @click="clearDevEvents()">
              {{ t(`${i18nKey}.clear`) }}
            </Button>
          </div>

          <div class="space-y-1" data-testid="crdt-dev-panel-log">
            <div
              v-for="row in visibleLogRows"
              :key="row.event.seq"
              class="border-b border-component-node-border pb-1"
            >
              <Button
                variant="muted-textonly"
                size="unset"
                class="block w-full rounded-none p-1 text-left font-mono text-xs whitespace-normal"
                @click="
                  expanded = expanded === row.event.seq ? null : row.event.seq
                "
              >
                <div class="flex items-baseline gap-1">
                  <span class="text-muted-foreground">{{
                    fmtTime(row.event.at)
                  }}</span>
                  <span
                    :class="
                      cn(
                        'rounded-sm border border-component-node-border px-1',
                        row.event.level === 'warn' &&
                          'border-destructive-background text-destructive-background'
                      )
                    "
                    >{{ row.event.scope }}</span
                  >
                  <span class="font-bold">{{ row.event.kind }}</span>
                </div>
                <div class="break-all text-muted-foreground">
                  {{
                    expanded === row.event.seq
                      ? truncateDetail(row.detail, 20_000)
                      : row.excerpt
                  }}
                </div>
              </Button>
              <div
                v-if="row.detail || row.nodeIds.length"
                class="mt-1 flex flex-wrap gap-1"
              >
                <Button
                  v-if="row.detail"
                  variant="outline"
                  size="sm"
                  :aria-label="t(`${i18nKey}.copyLogDetail`)"
                  @click="copyItem(`detail:${row.event.seq}`, row.detail)"
                >
                  {{ itemCopyLabel(`detail:${row.event.seq}`) }}
                </Button>
                <Button
                  v-for="nodeId in row.nodeIds"
                  :key="nodeId"
                  variant="outline"
                  size="sm"
                  :aria-label="t(`${i18nKey}.copyNodeId`, { nodeId })"
                  @click="copyItem(`node:${row.event.seq}:${nodeId}`, nodeId)"
                >
                  {{ itemCopyLabel(`node:${row.event.seq}:${nodeId}`, nodeId) }}
                </Button>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <div
            class="rounded-sm border border-component-node-border bg-secondary-background px-2 py-1 font-bold text-muted-foreground"
            data-testid="crdt-dev-panel-simulation-label"
          >
            {{ t(`${i18nKey}.simulated`) }}
          </div>

          <SingleSelect
            v-model="scenarioId"
            :label="t(`${i18nKey}.scenario`)"
            :options="scenarioOptions"
            class="w-full"
            data-testid="crdt-dev-panel-scenario"
            @update:model-value="selectScenario"
          />

          <p class="text-muted-foreground">
            {{ t(`${i18nKey}.question`) }}: {{ scenario.question }}
          </p>

          <Button
            variant="primary"
            class="w-full"
            data-testid="crdt-dev-panel-run"
            @click="run"
          >
            {{ t(`${i18nKey}.run`) }}
          </Button>

          <template v-if="simulation">
            <ol
              class="list-none space-y-2 pl-0"
              data-testid="crdt-dev-panel-trace"
            >
              <li
                v-for="entry in simulation.entries"
                :key="entry.index"
                class="border-l-2 border-component-node-border pl-2"
              >
                <div class="flex flex-wrap items-baseline gap-1">
                  <span class="text-muted-foreground"
                    >{{ entry.index + 1 }}.</span
                  >
                  <span class="font-bold">{{ entry.kind }}</span>
                  <span class="text-muted-foreground">{{ entry.actor }}</span>
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
                <div class="text-muted-foreground">
                  {{ registerLine(entry) }}
                </div>
                <p class="mt-0.5 mb-0">{{ entry.explanation }}</p>
              </li>
            </ol>

            <section>
              <div class="mb-1 font-bold text-muted-foreground">
                {{ t(`${i18nKey}.sectionOutcome`) }}
              </div>
              <div>
                {{
                  t(`${i18nKey}.survivingNodes`, {
                    count: simulation.survivingNodeIds.length
                  })
                }}:
                {{
                  simulation.survivingNodeIds.join(', ') || t(`${i18nKey}.none`)
                }}
              </div>
              <div class="break-all text-muted-foreground">
                {{ t(`${i18nKey}.survivingWidgets`) }}:
                {{
                  truncateDetail(stringifyDetail(simulation.survivingWidgets))
                }}
              </div>
            </section>

            <section v-if="registerGroups.length">
              <div class="mb-1 font-bold text-muted-foreground">
                {{ t(`${i18nKey}.sectionByRegister`) }}
              </div>
              <div v-for="group in registerGroups" :key="group.register">
                <div class="font-bold">{{ group.label }}</div>
                <div
                  v-for="entry in group.entries"
                  :key="entry.index"
                  class="pl-2 text-muted-foreground"
                >
                  {{ entry.kind }} · {{ entry.actor }} ·
                  {{ verdictLabel(entry) }}
                </div>
              </div>
            </section>

            <section v-if="lifecycle.length">
              <div class="mb-1 font-bold text-muted-foreground">
                {{ t(`${i18nKey}.sectionLifecycle`) }}
              </div>
              <div
                v-for="row in lifecycle"
                :key="`${row.nodeId}-${row.entry.index}`"
                class="text-muted-foreground"
              >
                {{ lifecycleLine(row) }}
              </div>
            </section>
          </template>

          <section>
            <div class="mb-1 font-bold text-muted-foreground">
              {{ t(`${i18nKey}.sectionVocab`) }}
            </div>
            <dl class="space-y-1">
              <div v-for="item in MERGE_VOCABULARY" :key="item.term">
                <dt class="font-bold">{{ item.term }}</dt>
                <dd class="ml-0 text-muted-foreground">{{ item.meaning }}</dd>
              </div>
            </dl>
          </section>

          <section>
            <label
              for="crdt-tester-note"
              class="mb-1 block font-bold text-muted-foreground"
              >{{ t(`${i18nKey}.notePrompt`) }}</label
            >
            <Textarea
              id="crdt-tester-note"
              v-model="testerNote"
              rows="3"
              :placeholder="t(`${i18nKey}.notePlaceholder`)"
              data-testid="crdt-dev-panel-note"
            />
          </section>
        </template>
      </div>

      <footer class="shrink-0 border-t border-component-node-border p-2">
        <div class="mb-1 text-muted-foreground">
          {{ t('agent.diagnosticReport.includedSources') }}
        </div>
        <div class="mb-1 flex flex-wrap gap-2">
          <label
            v-for="source in reportSourceLabels"
            :key="source.key"
            class="flex items-center gap-1 text-muted-foreground"
          >
            {{ source.label }}
            <Switch
              v-model="reportSources[source.key]"
              :aria-label="source.label"
              :data-testid="`crdt-dev-panel-include-${String(source.key)}`"
            />
          </label>
        </div>
        <p class="mt-0 mb-2 text-muted-foreground">
          {{ t(`${i18nKey}.includeHint`) }}
        </p>
        <div class="flex gap-1">
          <Button variant="outline" class="flex-1" @click="copyLog">
            {{ copyLogLabel }}
          </Button>
          <Button
            variant="primary"
            :loading="reportCopyState.status === 'busy'"
            class="flex-2"
            data-testid="crdt-dev-panel-copy-report"
            @click="copyReport"
          >
            {{ copyReportLabel }}
          </Button>
        </div>
        <div v-if="reportCopyState.status === 'failed'" class="mt-2">
          <p role="alert" class="text-danger m-0">
            {{
              reportCopyState.report === null
                ? t('agent.diagnosticReport.collectionFailed')
                : t('agent.diagnosticReport.clipboardFailed')
            }}
          </p>
          <Textarea
            v-if="reportCopyState.report !== null"
            :aria-label="t('agent.diagnosticReport.manualCopy')"
            :model-value="reportCopyState.report"
            readonly
            rows="3"
            class="mt-1"
          />
        </div>
      </footer>
    </section>
  </div>
</template>
