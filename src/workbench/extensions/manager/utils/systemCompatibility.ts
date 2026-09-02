import { isEmpty, isNil } from 'es-toolkit/compat'

import type {
  RegistryAccelerator,
  RegistryOS
} from '@/workbench/extensions/manager/types/compatibility.types'
import type { ConflictDetail } from '@/workbench/extensions/manager/types/conflictDetectionTypes'

/**
 * Maps system OS string to Registry OS format
 * @param systemOS Raw OS string from system stats ('darwin', 'win32', 'linux', etc)
 * @returns Registry OS or undefined if unknown
 */
function getRegistryOS(systemOS?: string): RegistryOS | undefined {
  if (!systemOS) return undefined

  const lower = systemOS.toLowerCase()
  // Check darwin first to avoid matching 'win' in 'darwin'
  if (lower.includes('darwin') || lower.includes('mac')) return 'macOS'
  if (lower.includes('win')) return 'Windows'
  if (lower.includes('linux')) return 'Linux'

  return undefined
}

/**
 * Maps device type to Registry accelerator format
 * @param deviceType Raw device type from system stats ('cuda', 'mps', 'rocm', 'cpu', etc)
 * @returns Registry accelerator
 */
function getRegistryAccelerator(deviceType?: string): RegistryAccelerator {
  if (!deviceType) return 'CPU'

  const lower = deviceType.toLowerCase()
  if (lower === 'cuda') return 'CUDA'
  if (lower === 'mps') return 'Metal'
  if (lower === 'rocm') return 'ROCm'

  return 'CPU'
}

const ACCELERATOR_ALIASES: Record<string, RegistryAccelerator> = {
  'gpu :: nvidia cuda': 'CUDA',
  'gpu :: amd rocm': 'ROCm',
  'gpu :: apple metal': 'Metal',
  cuda: 'CUDA',
  rocm: 'ROCm',
  metal: 'Metal',
  cpu: 'CPU'
}

/**
 * Checks OS compatibility
 * @param supported Supported OS list from Registry (null/undefined = all OS supported)
 * @param current Current system OS
 * @returns ConflictDetail if incompatible, null if compatible
 */
export function checkOSCompatibility(
  supported?: RegistryOS[] | null,
  current?: string
): ConflictDetail | null {
  // null/undefined/empty = all OS supported
  if (isNil(supported) || isEmpty(supported)) return null

  const currentOS = getRegistryOS(current)
  if (!currentOS) {
    return {
      type: 'os',
      current_value: 'Unknown',
      required_value: supported.join(', ')
    }
  }

  if (!supported.includes(currentOS)) {
    return {
      type: 'os',
      current_value: currentOS,
      required_value: supported.join(', ')
    }
  }

  return null
}

/**
 * Checks accelerator compatibility
 * @param supported Supported accelerators from Registry (null/undefined = all accelerators supported)
 * @param current Current device type
 * @returns ConflictDetail if incompatible, null if compatible
 */
export function checkAcceleratorCompatibility(
  supported?: RegistryAccelerator[] | null,
  current?: string
): ConflictDetail | null {
  // null/undefined/empty = all accelerator supported
  if (isNil(supported) || isEmpty(supported)) return null

  const currentAcc = getRegistryAccelerator(current)

  if (!supported.includes(currentAcc)) {
    return {
      type: 'accelerator',
      current_value: currentAcc,
      required_value: supported.join(', ')
    }
  }

  return null
}

/**
 * Normalizes accelerator values from the Registry API.
 *
 * Registry classifiers may contain the full `GPU :: vendor :: backend` form,
 * while compatibility checks use the frontend's canonical short names.
 * Unknown values are ignored; a list with no recognized accelerator means the
 * Registry did not supply an enforceable accelerator constraint.
 */
export function normalizeAcceleratorList(
  acceleratorValues?: string[] | null
): RegistryAccelerator[] | undefined {
  if (isNil(acceleratorValues) || isEmpty(acceleratorValues)) return undefined

  const validAccelerators: RegistryAccelerator[] = []
  for (const value of acceleratorValues) {
    const normalizedValue = value.trim().toLowerCase()
    const accelerator = ACCELERATOR_ALIASES[normalizedValue]

    if (accelerator && !validAccelerators.includes(accelerator)) {
      validAccelerators.push(accelerator)
    }
  }

  return validAccelerators.length > 0 ? validAccelerators : undefined
}

/**
 * Normalizes OS values from Registry API
 * Handles edge cases like "OS Independent"
 * @returns undefined if all OS supported, otherwise filtered valid OS list
 */
export function normalizeOSList(
  osValues?: string[] | null
): RegistryOS[] | undefined {
  if (isNil(osValues) || isEmpty(osValues)) return undefined

  // "OS Independent" means all OS supported
  if (osValues.some((os) => os.toLowerCase() === 'os independent')) {
    return undefined
  }

  // Filter to valid Registry OS values only
  const validOS: RegistryOS[] = []
  osValues.forEach((os) => {
    if (os === 'Windows' || os === 'macOS' || os === 'Linux') {
      if (!validOS.includes(os)) validOS.push(os)
    }
  })

  return validOS.length > 0 ? validOS : undefined
}
