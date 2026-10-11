import { computed, reactive, ref } from 'vue'

import { DEFAULT_POSE } from './cameraVocabulary'
import { resolveAsset } from './assetResolver'

/** Shared state for one hero pipeline instance: camera pose in, resolved
 * render + colour grade out. Desktop and mobile each own an instance. */
export function useHeroPipeline() {
  const pose = reactive({ ...DEFAULT_POSE })
  const hue = ref(0)
  const saturation = ref(1)

  const output = computed(() => resolveAsset(pose))
  const outputFilter = computed(() =>
    hue.value === 0 && saturation.value === 1
      ? undefined
      : `hue-rotate(${hue.value}deg) saturate(${saturation.value})`
  )

  return { pose, hue, saturation, output, outputFilter }
}
