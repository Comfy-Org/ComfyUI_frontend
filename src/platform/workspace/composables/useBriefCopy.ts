import { ref } from 'vue'

import { useCopyToClipboard } from '@/composables/useCopyToClipboard'

/** Copies an agent brief, one at a time, and says whether the last landed. */
export function useBriefCopy() {
  const { copyToClipboard } = useCopyToClipboard()
  const isCopying = ref(false)
  const copied = ref(false)

  async function copy(brief: string) {
    if (isCopying.value) return
    isCopying.value = true
    copied.value = false
    try {
      copied.value = await copyToClipboard(brief, { toastOnSuccess: false })
    } finally {
      isCopying.value = false
    }
  }

  return { isCopying, copied, copy }
}
