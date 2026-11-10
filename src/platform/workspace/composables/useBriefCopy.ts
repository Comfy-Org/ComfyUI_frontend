import { ref } from 'vue'

import { useCopyToClipboard } from '@/composables/useCopyToClipboard'

/** Copies an agent brief, one at a time, and says whether the last landed. */
export function useBriefCopy() {
  const { copyToClipboard } = useCopyToClipboard()
  const isCopying = ref(false)
  const copied = ref(false)

  /** Runs a copy that resolves whether it landed; ignored while one runs. */
  async function copyWith(write: () => Promise<boolean>) {
    if (isCopying.value) return
    isCopying.value = true
    copied.value = false
    try {
      copied.value = await write()
    } finally {
      isCopying.value = false
    }
  }

  function copy(brief: string) {
    return copyWith(() => copyToClipboard(brief, { toastOnSuccess: false }))
  }

  return { isCopying, copied, copy, copyWith }
}
