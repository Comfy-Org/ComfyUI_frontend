import { onScopeDispose, toValue, watch } from 'vue'
import type { Component, MaybeRefOrGetter } from 'vue'

import { useToast } from './toastStore'
import type { ToastId } from '@/types/toastId'

export function useDockedToast(
  visible: MaybeRefOrGetter<boolean>,
  panel: Component
) {
  const toast = useToast()
  let id: ToastId | undefined

  function undock() {
    if (id === undefined) return
    toast.dismiss(id)
    id = undefined
  }

  watch(
    () => toValue(visible),
    (shown) => {
      if (!shown) return undock()
      id ??= toast.custom(panel, {}, { placement: 'dock' })
    },
    { immediate: true }
  )
  onScopeDispose(undock)
}
