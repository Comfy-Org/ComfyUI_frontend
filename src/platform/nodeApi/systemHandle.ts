import { api } from '@/scripts/api'

import { ComfyApiError } from './errors'

const MAX_ITEMS = 64
const MAX_BYTES = Number.MAX_SAFE_INTEGER

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface SystemMonitorCpu {
  readonly utilization_percent: number | null
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface SystemMonitorMemory {
  readonly total: number
  readonly available: number
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface SystemMonitorVolume extends SystemMonitorMemory {
  readonly id: string
  readonly label: string
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface SystemMonitorAccelerator {
  readonly id: string
  readonly name: string
  readonly memory_total: number
  readonly memory_available: number
  readonly utilization_percent: number | null
  readonly temperature_c: number | null
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface SystemMonitorSnapshot {
  readonly cpu: SystemMonitorCpu
  readonly memory: SystemMonitorMemory
  readonly volumes: readonly SystemMonitorVolume[]
  readonly accelerators: readonly SystemMonitorAccelerator[]
}

export interface SystemHandle {
  /**
   * Returns one host-sampled hardware snapshot. Volume ids are opaque and
   * unsupported utilization or temperature sensors are null.
   */
  monitor(): Promise<SystemMonitorSnapshot>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown, limit: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= limit &&
    !value.includes('\0')
  )
}

function isBytes(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_BYTES
  )
}

function isPercent(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 100)
  )
}

function isTemperature(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= -273.15 &&
      value <= 1000)
  )
}

function isMemory(
  value: unknown
): value is SystemMonitorMemory & Record<string, unknown> {
  return (
    isRecord(value) &&
    isBytes(value.total) &&
    isBytes(value.available) &&
    value.available <= value.total
  )
}

function isVolume(value: unknown): value is SystemMonitorVolume {
  return isMemory(value) && isText(value.id, 128) && isText(value.label, 128)
}

function isAccelerator(value: unknown): value is SystemMonitorAccelerator {
  return (
    isRecord(value) &&
    isText(value.id, 128) &&
    isText(value.name, 256) &&
    isBytes(value.memory_total) &&
    isBytes(value.memory_available) &&
    value.memory_available <= value.memory_total &&
    isPercent(value.utilization_percent) &&
    isTemperature(value.temperature_c)
  )
}

function isSnapshot(value: unknown): value is SystemMonitorSnapshot {
  return (
    isRecord(value) &&
    isRecord(value.cpu) &&
    isPercent(value.cpu.utilization_percent) &&
    isMemory(value.memory) &&
    Array.isArray(value.volumes) &&
    value.volumes.length <= MAX_ITEMS &&
    value.volumes.every(isVolume) &&
    Array.isArray(value.accelerators) &&
    value.accelerators.length <= MAX_ITEMS &&
    value.accelerators.every(isAccelerator)
  )
}

export function createSystemApi(): SystemHandle {
  return Object.freeze({
    async monitor() {
      const response = await api.fetchApi('/system_monitor', {
        cache: 'no-store'
      })
      if (!response.ok) {
        throw new ComfyApiError(
          `System monitor request failed with status ${response.status}.`
        )
      }
      let value: unknown
      try {
        value = await response.json()
      } catch {
        throw new ComfyApiError('System monitor returned an invalid snapshot.')
      }
      if (!isSnapshot(value)) {
        throw new ComfyApiError('System monitor returned an invalid snapshot.')
      }
      return Object.freeze({
        cpu: Object.freeze({
          utilization_percent: value.cpu.utilization_percent
        }),
        memory: Object.freeze({
          total: value.memory.total,
          available: value.memory.available
        }),
        volumes: Object.freeze(
          value.volumes.map(({ id, label, total, available }) =>
            Object.freeze({ id, label, total, available })
          )
        ),
        accelerators: Object.freeze(
          value.accelerators.map(
            ({
              id,
              name,
              memory_total,
              memory_available,
              utilization_percent,
              temperature_c
            }) =>
              Object.freeze({
                id,
                name,
                memory_total,
                memory_available,
                utilization_percent,
                temperature_c
              })
          )
        )
      })
    }
  })
}
