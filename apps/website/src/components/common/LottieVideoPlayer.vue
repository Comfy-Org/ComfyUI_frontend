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
const assetsReady = ref(false)
let anim: AnimationItem | null = null

function swapImagesForVideos(container: HTMLElement): HTMLVideoElement[] {
  const svg = container.querySelector('svg')
  if (!svg) return []
  const videos: HTMLVideoElement[] = []
  for (const image of Array.from(svg.querySelectorAll('image'))) {
    const href =
      image.getAttribute('href') ?? image.getAttributeNS(XLINK_NS, 'href') ?? ''
    if (!/\.(webm|mp4)$/i.test(href)) continue
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
    videos.push(v)
  }
  return videos
}

function waitForVideosReady(videos: HTMLVideoElement[]): Promise<void> {
  if (videos.length === 0) return Promise.resolve()
  return new Promise((resolve) => {
    let pending = videos.length
    const finish = () => {
      pending--
      if (pending <= 0) resolve()
    }
    for (const v of videos) {
      if (v.readyState >= 2) finish()
      else {
        v.addEventListener('loadeddata', finish, { once: true })
        v.addEventListener('error', finish, { once: true })
      }
    }
  })
}

watch(
  [lottieContainer, () => src, () => assetsPath],
  async ([container]) => {
    anim?.destroy()
    anim = null
    assetsReady.value = false
    if (!container) return
    const { default: lottie } = await import('lottie-web')
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
      created.goToAndStop(0, true)
      const videos = swapImagesForVideos(container)
      waitForVideosReady(videos).then(() => {
        assetsReady.value = true
        emit('ready')
      })
    })
    created.addEventListener('data_failed', () => {
      console.error('[LottieVideoPlayer] Lottie data failed to load:', src)
      assetsReady.value = true
      emit('ready')
    })
  },
  { immediate: true }
)

watch(
  () => assetsReady.value && playing,
  (shouldPlay) => {
    if (!anim) return
    if (shouldPlay) anim.goToAndPlay(0, true)
    else anim.pause()
  }
)

onBeforeUnmount(() => {
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
