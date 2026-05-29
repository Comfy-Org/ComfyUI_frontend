import { ref } from 'vue'

/**
 * Reactive snapshot of the device the canvas pointer auto-detection currently
 * believes is in use. Updated by a callback wired in useLitegraphSettings.
 */
const detectedInputDevice = ref<'mouse' | 'trackpad'>('mouse')

export function useInputDeviceDetection() {
  return { detectedInputDevice }
}
