import { vi } from 'vitest'

export interface FakeImageDecoder {
  /**
   * Sources whose `onload` has fired, oldest first. An assertion that
   * something is absent proves nothing until the source it depends on appears
   * here: the tick before a decode satisfies it whatever the code decides.
   */
  readonly decoded: readonly string[]
  /** Declares a source's dimensions and returns it, for use as a frame url. */
  frame(src: string, width: number, height: number): string
  /** Sources whose held decode has not been settled yet. */
  readonly pending: readonly string[]
  /** Stops decodes completing on their own, so `settle` can order them. */
  hold(): void
  /** Completes the held decode of `src`. */
  settle(src: string): void
}

/**
 * Controllable `Image`: happy-dom never decodes, so tests declare each
 * source's size and let the decode settle on its own, or hold it and resolve
 * by hand when the order of two decodes is what is under test.
 */
export function stubImageDecoder(): FakeImageDecoder {
  const sizes = new Map<string, { width: number; height: number }>()
  const decoded: string[] = []
  const held: { src: string; load: () => void }[] = []
  let holding = false

  class StubImage {
    onload: (() => void) | null = null
    naturalWidth = 0
    naturalHeight = 0
    private source = ''
    set src(value: string) {
      this.source = value
      const size = sizes.get(value)
      if (!size) return
      this.naturalWidth = size.width
      this.naturalHeight = size.height
      const load = () => {
        decoded.push(value)
        this.onload?.()
      }
      if (holding) held.push({ src: value, load })
      else queueMicrotask(load)
    }
    get src(): string {
      return this.source
    }
  }

  vi.stubGlobal('Image', StubImage)

  return {
    decoded,
    get pending() {
      return held.map((entry) => entry.src)
    },
    frame(src, width, height) {
      sizes.set(src, { width, height })
      return src
    },
    hold() {
      holding = true
    },
    settle(src) {
      const index = held.findIndex((entry) => entry.src === src)
      if (index === -1) throw new Error(`No decode is pending for ${src}`)
      held.splice(index, 1)[0].load()
    }
  }
}
