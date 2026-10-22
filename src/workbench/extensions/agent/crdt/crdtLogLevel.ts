import type { Settings } from '@/platform/settings/types'

export type CrdtLogLevel = Settings['Comfy.Agent.CrdtDebug.Level']

export const CRDT_LOG_LEVELS: readonly CrdtLogLevel[] = [
  'warn',
  'info',
  'debug',
  'trace'
]
