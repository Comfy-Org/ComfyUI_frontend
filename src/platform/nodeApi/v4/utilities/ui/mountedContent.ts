import { callListener } from '@/platform/nodeApi/shared/listeners'

/** A pack's render and destroy, isolated, with destroy run once after each render. */
export interface MountedContent {
  render(container: HTMLElement): void
  destroy(): void
}

export function mountedContent(
  member: string,
  render: (container: HTMLElement) => unknown,
  destroy: (() => unknown) | undefined
): MountedContent {
  let rendered = false
  return {
    render(container) {
      rendered = true
      callListener(member, () => render(container))
    },
    destroy() {
      if (!rendered) return
      rendered = false
      if (destroy) callListener(member, () => destroy())
    }
  }
}
