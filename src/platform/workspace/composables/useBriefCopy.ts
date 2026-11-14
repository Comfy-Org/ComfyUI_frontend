import { ref } from 'vue'

export function useBriefCopy() {
  const isCopying = ref(false)
  const copied = ref(false)

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

  return { isCopying, copied, copyWith }
}
