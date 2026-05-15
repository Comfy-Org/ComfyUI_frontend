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

const lottieContainer = useTemplateRef<HTMLDivElement>('lottieContainer')
const assetsLoaded = ref(false)
let anim: AnimationItem | null = null
let videos: HTMLVideoElement[] = []
let images: HTMLImageElement[] = []
let loadGen = 0
let playRaf: number | null = null

function abortPreloadedImages(toAbort: HTMLImageElement[]) {
  // Setting src to '' aborts in-flight downloads in most browsers and lets
  // already-loaded Image objects be released.
  for (const img of toAbort) img.src = ''
}

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
  v.autoplay = false
  v.preload = 'auto'
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

function prepareAssets(container: HTMLElement): {
  videos: HTMLVideoElement[]
  images: HTMLImageElement[]
  ready: Promise<void>
} {
  const svg = container.querySelector('svg')
  if (!svg) return { videos: [], images: [], ready: Promise.resolve() }
  const collectedVideos: HTMLVideoElement[] = []
  const collectedImages: HTMLImageElement[] = []
  const pending: Promise<void>[] = []
  for (const image of Array.from(svg.querySelectorAll('image'))) {
    const href =
      image.getAttribute('href') ?? image.getAttributeNS(XLINK_NS, 'href') ?? ''
    if (!href) continue
    if (/\.(webm|mp4)$/i.test(href)) {
      const v = swapImageForVideo(image, href)
      collectedVideos.push(v)
      pending.push(whenLoaded(v))
    } else {
      const img = new Image()
      img.src = href
      collectedImages.push(img)
      pending.push(whenLoaded(img))
    }
  }
  return {
    videos: collectedVideos,
    images: collectedImages,
    ready: Promise.all(pending).then(() => undefined)
  }
}

watch(
  [lottieContainer, () => src, () => assetsPath],
  async ([container]) => {
    const gen = ++loadGen
    for (const v of videos) v.pause()
    abortPreloadedImages(images)
    videos = []
    images = []
    anim?.destroy()
    anim = null
    assetsLoaded.value = false
    if (!container) return
    try {
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
        const {
          videos: loadedVideos,
          images: loadedImages,
          ready
        } = prepareAssets(container)
        // Assign eagerly so the next-gen cleanup pass can pause/abort these
        // assets even if `ready` is still pending when src changes again.
        videos = loadedVideos
        images = loadedImages
        void ready.then(() => {
          if (gen !== loadGen || anim !== created) return
          assetsLoaded.value = true
          emit('ready')
        })
      })
      created.addEventListener('data_failed', () => {
        if (gen !== loadGen || anim !== created) return
        console.error('[LottieVideoPlayer] Lottie data failed to load:', src)
        emit('ready')
      })
    } catch (err) {
      if (gen !== loadGen) return
      console.error('[LottieVideoPlayer] failed to initialize:', src, err)
      anim?.destroy()
      anim = null
      assetsLoaded.value = false
      emit('ready')
    }
  },
  { immediate: true }
)

watch(
  () => assetsLoaded.value && playing,
  (shouldPlay) => {
    if (playRaf !== null) {
      cancelAnimationFrame(playRaf)
      playRaf = null
    }
    if (shouldPlay) {
      // Defer heavy startup work (lottie SVG seek + video decoder init) to the
      // next animation frame so the parent's opacity transition can paint its
      // first frame before the main thread is blocked.
      const gen = loadGen
      playRaf = requestAnimationFrame(() => {
        playRaf = null
        if (gen !== loadGen) return
        anim?.goToAndPlay(0, true)
        for (const v of videos) {
          void v.play().catch(() => {})
        }
      })
    } else {
      anim?.pause()
      for (const v of videos) {
        v.pause()
        v.currentTime = 0
      }
    }
  }
)

onBeforeUnmount(() => {
  if (playRaf !== null) cancelAnimationFrame(playRaf)
  for (const v of videos) v.pause()
  abortPreloadedImages(images)
  anim?.destroy()
})
</script>

<template>
  <div class="relative">
    <div ref="lottieContainer" class="size-full" />
    <img
      v-if="poster && !assetsLoaded"
      :src="poster"
      alt=""
      aria-hidden="true"
      :class="
        cn(
          'pointer-events-none absolute inset-0 size-full object-cover',
          posterClass
        )
      "
    />
  </div>
</template>
