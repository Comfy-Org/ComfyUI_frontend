import type { DetachedWindowAPI } from 'happy-dom'

type Viewport = Parameters<DetachedWindowAPI['setViewport']>[0]

export function setHappyDomViewport(viewport: Viewport): void {
  if (!('happyDOM' in window)) {
    throw new Error('window.happyDOM is unavailable to set viewport')
  }

  const { happyDOM } = window
  if (
    typeof happyDOM !== 'object' ||
    happyDOM === null ||
    !('setViewport' in happyDOM) ||
    typeof happyDOM.setViewport !== 'function'
  ) {
    throw new Error('window.happyDOM is unavailable to set viewport')
  }

  happyDOM.setViewport(viewport)
}
