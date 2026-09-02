import type { Ref } from 'vue'
import { onMounted, onUnmounted } from 'vue'

import { gsap } from '../scripts/gsapSetup'
import { prefersReducedMotion } from './useReducedMotion'

interface FrameScrubOptions {
  urls: string[]
  scrollTrigger: (canvas: HTMLCanvasElement) => ScrollTrigger.Vars
}

type Frame = HTMLImageElement | ImageBitmap

const FRAME_LOAD_BATCH_SIZE = 4
const MAX_CANVAS_DPR = 2

function closeFrames(frames: Frame[]) {
  for (const frame of frames) {
    if ('close' in frame) frame.close()
  }
}

function loadImage(
  url: string,
  signal: AbortSignal
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const cleanup = () => {
      img.onload = null
      img.onerror = null
      signal.removeEventListener('abort', handleAbort)
    }
    function handleAbort() {
      cleanup()
      img.src = ''
      reject(signal.reason)
    }

    img.crossOrigin = 'anonymous'
    img.onload = () => {
      cleanup()
      resolve(img)
    }
    img.onerror = () => {
      cleanup()
      reject(new Error(`Failed to load ${url}`))
    }
    signal.addEventListener('abort', handleAbort, { once: true })
    if (signal.aborted) return handleAbort()
    img.src = url
  })
}

async function loadFrame(
  url: string,
  width: number,
  height: number,
  signal: AbortSignal
): Promise<Frame> {
  signal.throwIfAborted()
  if (typeof createImageBitmap !== 'function') return loadImage(url, signal)

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Failed to load ${url}`)

  const bitmap = await createImageBitmap(await response.blob(), {
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: 'high'
  })
  if (!signal.aborted) return bitmap

  bitmap.close()
  throw signal.reason
}

async function loadFrames(
  urls: string[],
  width: number,
  height: number,
  signal: AbortSignal
): Promise<Frame[]> {
  const frames: Frame[] = []
  try {
    for (let index = 0; index < urls.length; index += FRAME_LOAD_BATCH_SIZE) {
      const batchUrls = urls.slice(index, index + FRAME_LOAD_BATCH_SIZE)
      const results = await Promise.allSettled(
        batchUrls.map((url) => loadFrame(url, width, height, signal))
      )
      frames.push(
        ...results.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : []
        )
      )

      const failure = results.find((result) => result.status === 'rejected')
      if (failure?.status === 'rejected') throw failure.reason
    }
    return frames
  } catch (error) {
    closeFrames(frames)
    throw error
  }
}

export function useFrameScrub(
  canvasRef: Ref<HTMLCanvasElement | undefined>,
  options: FrameScrubOptions
) {
  let ctx: gsap.Context | undefined
  let frames: Frame[] = []
  const loadController = new AbortController()

  onMounted(async () => {
    const canvas = canvasRef.value
    if (!canvas || prefersReducedMotion()) return

    const draw = canvas.getContext('2d')
    if (!draw) return

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR)
    const width = Math.max(Math.round(canvas.clientWidth * dpr), 1)
    const height = Math.max(Math.round(canvas.clientHeight * dpr), 1)
    canvas.width = width
    canvas.height = height

    try {
      frames = await loadFrames(
        options.urls,
        width,
        height,
        loadController.signal
      )
    } catch (error) {
      if (loadController.signal.aborted) return
      throw error
    }
    if (loadController.signal.aborted) {
      closeFrames(frames)
      frames = []
      return
    }
    if (!frames.length) return

    function drawFrame(index: number) {
      const frame = frames[Math.round(index)]
      if (!frame || !draw) return
      draw.clearRect(0, 0, width, height)
      draw.drawImage(frame, 0, 0, width, height)
    }

    drawFrame(0)

    const proxy = { frame: 0 }
    ctx = gsap.context(() => {
      gsap.to(proxy, {
        frame: frames.length - 1,
        ease: 'none',
        scrollTrigger: options.scrollTrigger(canvas),
        onUpdate() {
          drawFrame(proxy.frame)
        }
      })
    })
  })

  onUnmounted(() => {
    loadController.abort()
    ctx?.revert()
    closeFrames(frames)
    frames = []
  })
}
