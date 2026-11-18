import type {
  SystemHandle,
  SystemMonitorAccelerator,
  SystemMonitorSnapshot
} from '@/platform/nodeApi/v4/types'
import { api } from '@/scripts/api'

import { isFiniteNumber, isObject, isText } from './packArguments'

export function createSystemHandle(): SystemHandle {
  const system: SystemHandle = { monitor: readSnapshot }
  return Object.freeze(system)
}

async function readSnapshot(): Promise<SystemMonitorSnapshot | undefined> {
  let stats: unknown
  try {
    stats = await api.getSystemStats()
  } catch {
    return undefined
  }
  return snapshotOf(stats)
}

function snapshotOf(stats: unknown): SystemMonitorSnapshot | undefined {
  if (!isObject(stats)) return undefined
  const system: unknown = Reflect.get(stats, 'system')
  const devices: unknown = Reflect.get(stats, 'devices')
  if (!isObject(system) || !Array.isArray(devices)) return undefined
  const total: unknown = Reflect.get(system, 'ram_total')
  const available: unknown = Reflect.get(system, 'ram_free')
  if (!isByteCount(total) || !isByteCount(available)) return undefined
  const accelerators = devices
    .filter((device: unknown) => !isCpu(device))
    .map(acceleratorOf)
  if (!accelerators.every(isAccelerator)) return undefined
  return Object.freeze({
    memory: Object.freeze({ total, available }),
    accelerators: Object.freeze(accelerators)
  })
}

function isCpu(device: unknown): boolean {
  return isObject(device) && Reflect.get(device, 'type') === 'cpu'
}

function acceleratorOf(device: unknown): SystemMonitorAccelerator | undefined {
  if (!isObject(device)) return undefined
  const name: unknown = Reflect.get(device, 'name')
  const total: unknown = Reflect.get(device, 'vram_total')
  const available: unknown = Reflect.get(device, 'vram_free')
  if (!isText(name) || !isByteCount(total) || !isByteCount(available)) {
    return undefined
  }
  return Object.freeze({
    id: name,
    name,
    memoryTotal: total,
    memoryAvailable: available
  })
}

function isAccelerator(
  accelerator: SystemMonitorAccelerator | undefined
): accelerator is SystemMonitorAccelerator {
  return accelerator !== undefined
}

function isByteCount(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}
