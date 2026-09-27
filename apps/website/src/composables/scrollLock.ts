import { scrollTo, stopScroller, startScroller } from '../scripts/smoothScroll'

let savedScrollY = 0
let lockCount = 0

export function lockScroll() {
  lockCount++
  if (lockCount > 1) return

  savedScrollY = window.scrollY

  stopScroller()

  Object.assign(document.body.style, {
    position: 'fixed',
    top: `-${savedScrollY}px`,
    left: '0',
    right: '0'
  })
}

export function unlockScroll(options?: { skipRestore?: boolean }) {
  if (lockCount <= 0) return
  lockCount--
  if (lockCount > 0) return

  Object.assign(document.body.style, {
    position: '',
    top: '',
    left: '',
    right: ''
  })

  if (!options?.skipRestore) {
    scrollTo(savedScrollY, { immediate: true })
  }

  startScroller()
}
