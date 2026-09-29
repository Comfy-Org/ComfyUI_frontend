import { useElementSize } from '@vueuse/core'
import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import { toValue, watchEffect } from 'vue'

export function useStickyFooterScrollPadding(
  footer: Readonly<ShallowRef<HTMLElement | null>>,
  active: MaybeRefOrGetter<boolean>
) {
  const { height } = useElementSize(footer, undefined, { box: 'border-box' })
  watchEffect((onCleanup) => {
    if (!toValue(active) || !height.value) return
    const root = document.documentElement
    const previous = root.style.scrollPaddingBottom
    root.style.scrollPaddingBottom = `${Math.ceil(height.value)}px`
    onCleanup(() => {
      root.style.scrollPaddingBottom = previous
    })
  })
}
