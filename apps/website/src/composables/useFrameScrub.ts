import type { Ref } from 'vue'
import { onMounted, onUnmounted } from 'vue'

import { gsap } from '../scripts/gsapSetup'
import { prefersReducedMotion } from './useReducedMotion'

interface FrameScrubOptions {
  urls: string[]
  scrollTrigger: (canvas: HTMLCanvasElement) => ScrollTrigger.Vars
}

function loadFrames(urls: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = () => reject(new Error(`Failed to load ${url}`))
          img.src = url
        })
    )
  )
}

export function useFrameScrub(
  canvasRef: Ref<HTMLCanvasElement | undefined>,
  options: FrameScrubOptions
) {
  let ctx: gsap.Context | undefined

  onMounted(async () => {
    const canvas = canvasRef.value
    if (!canvas || prefersReducedMotion()) return

    const draw = canvas.getContext('2d')
    if (!draw) return

    const frames = await loadFrames(options.urls)
    if (!frames.length) return

    const { naturalWidth: w, naturalHeight: h } = frames[0]
    canvas.width = w
    canvas.height = h

    function drawFrame(index: number) {
      const img = frames[Math.round(index)]
      if (!img || !draw) return
      draw.clearRect(0, 0, w, h)
      draw.drawImage(img, 0, 0)
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
    ctx?.revert()
  })
}
