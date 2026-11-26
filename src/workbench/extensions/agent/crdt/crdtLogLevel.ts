import type { Settings } from '@comfyorg/settings-core/types'

export type CrdtLogLevel = Settings['Comfy.Agent.CrdtDebug.Level']

export const CRDT_LOG_LEVELS: readonly CrdtLogLevel[] = [
  'warn',
  'info',
  'debug',
  'trace'
]
