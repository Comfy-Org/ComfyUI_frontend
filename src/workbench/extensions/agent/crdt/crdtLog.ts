import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/platform/settings/types'

import type { CrdtLogScope, DevEventKind } from './devPanelLog'
import { recordDevEvent, sanitizeDevEventDetail } from './devPanelLog'

const { flags } = useFeatureFlags()
export type CrdtLogLevel = Settings['Comfy.Agent.CrdtDebug.Level']
export const CRDT_LOG_LEVELS: readonly CrdtLogLevel[] = [
  'warn',
  'info',
  'debug',
  'trace'
]

const SCOPE_STYLE: Record<CrdtLogScope, string> = {
  wire: 'color:#7dd3fc',
  doc: 'color:#a5b4fc'
}

const CONSOLE_METHOD: Record<CrdtLogLevel, 'warn' | 'info' | 'debug'> = {
  warn: 'warn',
  info: 'info',
  debug: 'debug',
  trace: 'debug'
}

interface CrdtLogEntry {
  scope: CrdtLogScope
  level: CrdtLogLevel
  kind: DevEventKind
  message: string
  detail?: unknown
}

function crdtLog(entry: CrdtLogEntry): void {
  if (!flags.agentCrdtDebugEnabled) return
  const { scope, level, kind, message, detail } = entry
  recordDevEvent(kind, detail ?? null, { scope, level })
  const threshold = useSettingStore().get('Comfy.Agent.CrdtDebug.Level')
  if (CRDT_LOG_LEVELS.indexOf(level) > CRDT_LOG_LEVELS.indexOf(threshold))
    return
  const line = `%c[crdt:${scope}]%c ${kind} — ${message}`
  const args: unknown[] = [line, SCOPE_STYLE[scope], '']
  if (detail !== undefined) args.push(sanitizeDevEventDetail(detail))
  console[CONSOLE_METHOD[level]](...args)
}

function scopedCrdtLog(scope: CrdtLogScope) {
  const at =
    (level: CrdtLogLevel) =>
    (kind: DevEventKind, message: string, detail?: unknown): void =>
      crdtLog({ scope, level, kind, message, detail })

  return {
    warn: at('warn'),
    info: at('info'),
    debug: at('debug'),
    trace: at('trace')
  }
}

export const wireLog = scopedCrdtLog('wire')
