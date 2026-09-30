import { useMounted, useObjectUrl } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { Locale } from '../i18n/translations'

/** What a preview needs to show one chosen file, whatever kind it is. */
export interface SourcePreviewProps {
  /** The file while it is only in this browser, before any upload. */
  file?: File
  /** Where it already lives, for a file the page did not choose. */
  src?: string
  name: string
  locale?: Locale
}

/**
 * The address to point a preview at: the chosen file, once the browser can
 * mint a URL for it, or the one it already had.
 */
export function useSourceUrl(
  file: MaybeRefOrGetter<File | undefined>,
  src: MaybeRefOrGetter<string | undefined>
) {
  const mounted = useMounted()
  const objectUrl = useObjectUrl(() =>
    mounted.value ? toValue(file) : undefined
  )
  return computed(() => objectUrl.value ?? toValue(src))
}
