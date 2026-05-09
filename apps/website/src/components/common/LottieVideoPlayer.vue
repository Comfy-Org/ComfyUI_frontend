<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { AnimationItem } from 'lottie-web'
import { onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'

const {
  src,
  assetsPath,
  poster,
  playing = true,
  posterClass = ''
} = defineProps<{
  src: string
  assetsPath?: string
  poster?: string
  playing?: boolean
  posterClass?: string
}>()

const emit = defineEmits<{ ready: [] }>()

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'

const POSTER_FADE_MS = 500

const lottieContainer = useTemplateRef<HTMLDivElement>('lottieContainer')
const assetsReady = ref(false)
const posterFaded = ref(!poster)
let anim: AnimationItem | null = null
let loadGen = 0
let fadeTimer: ReturnType<typeof setTimeout> | null = null

watch(assetsReady, (ready) => {
  if (fadeTimer) {
    clearTimeout(fadeTimer)
    fadeTimer = null
  }
  if (!ready) {
    posterFaded.value = !poster
    return
  }
  if (!poster) {
    posterFaded.value = true
    return
  }
  fadeTimer = setTimeout(() => {
    posterFaded.value = true
    fadeTimer = null
  }, POSTER_FADE_MS)
})

function swapImageForVideo(
  image: SVGImageElement,
  href: string
): HTMLVideoElement {
  const width = image.getAttribute('width') ?? '0'
  const height = image.getAttribute('height') ?? '0'
  const fo = document.createElementNS(SVG_NS, 'foreignObject')
  fo.setAttribute('x', '0')
  fo.setAttribute('y', '0')
  fo.setAttribute('width', width)
  fo.setAttribute('height', height)
  const v = document.createElement('video')
  v.src = href
  v.autoplay = true
  v.loop = true
  v.muted = true
  v.playsInline = true
  v.setAttribute('playsinline', '')
  v.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;'
  fo.appendChild(v)
  image.replaceWith(fo)
  return v
}

function whenLoaded(el: HTMLVideoElement | HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    if (el instanceof HTMLVideoElement && el.readyState >= 2) return resolve()
    if (el instanceof HTMLImageElement && el.complete) return resolve()
    const event = el instanceof HTMLVideoElement ? 'loadeddata' : 'load'
    el.addEventListener(event, () => resolve(), { once: true })
    el.addEventListener('error', () => resolve(), { once: true })
  })
}

function prepareAssets(container: HTMLElement): Promise<void> {
  const svg = container.querySelector('svg')
  if (!svg) return Promise.resolve()
  const pending: Promise<void>[] = []
  for (const image of Array.from(svg.querySelectorAll('image'))) {
    const href =
      image.getAttribute('href') ?? image.getAttributeNS(XLINK_NS, 'href') ?? ''
    if (!href) continue
    if (/\.(webm|mp4)$/i.test(href)) {
      pending.push(whenLoaded(swapImageForVideo(image, href)))
    } else {
      const img = new Image()
      img.src = href
      pending.push(whenLoaded(img))
    }
  }
  return Promise.all(pending).then(() => undefined)
}

watch(
  [lottieContainer, () => src, () => assetsPath],
  async ([container]) => {
    const gen = ++loadGen
    anim?.destroy()
    anim = null
    assetsReady.value = false
    if (!container) return
    const { default: lottie } = await import('lottie-web')
    if (gen !== loadGen) return
    const created = lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: true,
      autoplay: false,
      path: src,
      assetsPath,
      rendererSettings: { preserveAspectRatio: 'xMidYMid slice' }
    })
    anim = created
    created.addEventListener('DOMLoaded', () => {
      if (gen !== loadGen || anim !== created) return
      created.goToAndStop(0, true)
      void prepareAssets(container).then(() => {
        if (gen !== loadGen || anim !== created) return
        assetsReady.value = true
        emit('ready')
      })
    })
    created.addEventListener('data_failed', () => {
      if (gen !== loadGen || anim !== created) return
      console.error('[LottieVideoPlayer] Lottie data failed to load:', src)
      emit('ready')
    })
  },
  { immediate: true }
)

watch(
  () => assetsReady.value && posterFaded.value && playing,
  (shouldPlay) => {
    if (!anim) return
    if (shouldPlay) anim.goToAndPlay(0, true)
    else anim.pause()
  }
)

onBeforeUnmount(() => {
  if (fadeTimer) clearTimeout(fadeTimer)
  anim?.destroy()
})
</script>

<template>
  <div class="relative">
    <div ref="lottieContainer" class="size-full" />
    <img
      v-if="poster"
      :src="poster"
      alt=""
      aria-hidden="true"
      :class="
        cn(
          'pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-500',
          assetsReady ? 'opacity-0' : 'opacity-100',
          posterClass
        )
      "
    />
  </div>
</template>
