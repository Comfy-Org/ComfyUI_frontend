<script setup lang="ts">
import { useElementVisibility } from '@vueuse/core'
import { onScopeDispose, ref, useTemplateRef, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'

const { src, active = true } = defineProps<{
  /** Path to the Lottie JSON; its `images/` siblings resolve alongside it. */
  src: string
  /** Play only while the owning slide is showing. */
  active?: boolean
}>()

type LottieAnimation = {
  destroy: () => void
  play: () => void
  pause: () => void
  goToAndStop: (value: number, isFrame?: boolean) => void
}

const containerRef = useTemplateRef<HTMLElement>('containerRef')
const onScreen = useElementVisibility(containerRef)

let anim: LottieAnimation | undefined
const loaded = ref(false)

// lottie-web is ~150KB gzipped, so it only loads once the scene scrolls in.
watch([containerRef, onScreen], async ([el, visible]) => {
  if (!el || !visible || anim) return
  const lottie = (await import('lottie-web')).default
  anim = lottie.loadAnimation({
    container: el,
    renderer: 'svg',
    loop: true,
    autoplay: false,
    path: src,
    assetsPath: `${src.slice(0, src.lastIndexOf('/'))}/images/`,
    // Fill the frame like the object-cover videos this replaced.
    rendererSettings: { preserveAspectRatio: 'xMidYMid slice' }
  }) as unknown as LottieAnimation
  loaded.value = true
  syncPlayback()
})

function syncPlayback() {
  if (!anim) return
  if (prefersReducedMotion()) {
    // Hold the first frame so the composition still reads as an illustration.
    anim.goToAndStop(0, true)
    return
  }
  if (active && onScreen.value) anim.play()
  else anim.pause()
}

watch(() => [active, onScreen.value], syncPlayback)

onScopeDispose(() => anim?.destroy())
</script>

<template>
  <div
    ref="containerRef"
    class="size-full [&_svg]:size-full"
    aria-hidden="true"
  />
</template>
