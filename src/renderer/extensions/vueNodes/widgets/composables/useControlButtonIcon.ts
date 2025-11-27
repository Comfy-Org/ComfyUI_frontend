import { computed } from 'vue'
import type { Ref } from 'vue'

import { NumberControlMode } from './useStepperControl'

export function useControlButtonIcon(controlMode: Ref<NumberControlMode>) {
  return computed(() => {
    switch (controlMode.value) {
      case NumberControlMode.INCREMENT:
        return 'pi pi-plus'
      case NumberControlMode.DECREMENT:
        return 'pi pi-minus'
      case NumberControlMode.FIXED:
        return 'icon-[lucide--pencil-off]'
      case NumberControlMode.LINK_TO_GLOBAL:
        return 'pi pi-link'
      default:
        return 'icon-[lucide--shuffle]'
    }
  })
}
