import type { Ref } from 'vue'
import { onMounted, onUnmounted } from 'vue'
import { gsap, ScrollTrigger } from '../scripts/smoothScroll'

interface FrameScrubOptions {
  frameCount: number
  frameSrc: (index: number) => string
  scrollTrigger: (canvas: HTMLCanvasElement) => ScrollTrigger.Vars
}

export function useFrameScrub(
  canvasRef: Ref<HTMLCanvasElement | undefined>,
  options: FrameScrubOptions
) {
  let ctx: gsap.Context | undefined

  onMounted(() => {
    if (!canvasRef.value) return
    const canvas: HTMLCanvasElement = canvasRef.value

    const context = canvas.getContext('2d')!
    const images: HTMLImageElement[] = []
    let loadedCount = 0
    const resolvedTrigger = options.scrollTrigger(canvas)

    function drawFrame(frame: number) {
      const index = Math.round(frame)
      const img = images[index]
      if (!img) return
      canvas.width = img.width
      canvas.height = img.height
      context.drawImage(img, 0, 0)
    }

    for (let i = 0; i < options.frameCount; i++) {
      const img = new Image()
      img.src = options.frameSrc(i)
      img.onload = () => {
        loadedCount++
        if (loadedCount === options.frameCount) {
          drawFrame(0)
          initScrub()
        }
      }
      images.push(img)
    }

    function initScrub() {
      ScrollTrigger.refresh()
      const proxy = { frame: 0 }
      ctx = gsap.context(() => {
        gsap.to(proxy, {
          frame: options.frameCount - 1,
          ease: 'none',
          scrollTrigger: resolvedTrigger,
          onUpdate() {
            drawFrame(proxy.frame)
          }
        })
      })
    }
  })

  onUnmounted(() => {
    ctx?.revert()
  })
}
