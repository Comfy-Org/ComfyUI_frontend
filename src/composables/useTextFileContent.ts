import { computedAsync } from '@vueuse/core'
import { ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

interface TextSource {
  content?: string
  url?: string
}

export function useTextFileContent(
  source: MaybeRefOrGetter<TextSource | undefined>
) {
  const isLoading = ref(false)
  const hasError = ref(false)

  const textContent = computedAsync(
    async () => {
      hasError.value = false
      const { content, url } = toValue(source) ?? {}
      if (content !== undefined) return content
      if (!url) return ''

      const response = await fetch(url)
      if (!response.ok) {
        hasError.value = true
        return ''
      }
      return await response.text()
    },
    '',
    {
      evaluating: isLoading,
      onError: () => {
        hasError.value = true
      }
    }
  )

  return { textContent, isLoading, hasError }
}
