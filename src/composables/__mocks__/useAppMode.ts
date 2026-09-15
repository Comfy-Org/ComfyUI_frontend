import { vi } from 'vitest'
import { computed, ref } from 'vue'

import type { useAppMode as realUseAppMode } from '../useAppMode'

export const useAppMode = vi.fn<typeof realUseAppMode>(() => ({
  mode: computed(() => 'graph'),
  enableAppBuilder: ref(true),
  isBuilderMode: computed(() => false),
  isSelectMode: computed(() => false),
  isSelectInputsMode: computed(() => false),
  isSelectOutputsMode: computed(() => false),
  isArrangeMode: computed(() => false),
  isAppMode: computed(() => false),
  isGraphMode: computed(() => true),
  setMode: vi.fn()
}))
