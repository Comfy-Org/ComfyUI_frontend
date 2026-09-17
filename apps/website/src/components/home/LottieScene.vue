<script setup lang="ts">
import { useElementVisibility } from '@vueuse/core'
import type { AnimationItem } from 'lottie-web'
import { onScopeDispose, useTemplateRef, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'

const { src, active = true } = defineProps<{
  /** Path to the Lottie JSON; its `images/` siblings resolve alongside it. */
  src: string
  /** Play only while the owning slide is showing. */
  active?: boolean
}>()

const containerRef = useTemplateRef<HTMLElement>('containerRef')
const onScreen = useElementVisibility(containerRef)

let anim: AnimationItem | undefined

/** Flips before the dynamic import: the watch can fire again while the chunk
 * downloads, and guarding on `anim` alone would stack a second animation
 * into the same container. Reset on failure so a transient error can retry. */
let loadStarted = false
let disposed = false

// lottie-web is ~150KB gzipped, so it only loads once the scene scrolls in.
watch([containerRef, onScreen], async ([el, visible]) => {
  if (!el || !visible || loadStarted) return
  loadStarted = true
  let lottie
  try {
    lottie = (await import('lottie-web')).default
  } catch {
    loadStarted = false
    return
  }
  // The mobile accordion can unmount this scene while the chunk downloads;
  // an animation created after disposal would never be destroyed.
  if (disposed) return
  anim = lottie.loadAnimation({
    container: el,
    renderer: 'svg',
    loop: true,
    autoplay: false,
    path: src,
    assetsPath: `${src.slice(0, src.lastIndexOf('/'))}/images/`,
    // Fill the frame like the object-cover videos this replaced.
    rendererSettings: { preserveAspectRatio: 'xMidYMid slice' }
  })
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

onScopeDispose(() => {
  disposed = true
  anim?.destroy()
})
</script>

<template>
  <div
    ref="containerRef"
    class="size-full [&_svg]:size-full"
    aria-hidden="true"
  />
</template>
