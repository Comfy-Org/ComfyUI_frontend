import { beforeEach } from 'vitest'

export function setupInlinePromptEditorDom(): void {
  beforeEach(() => {
    const fallbacks = [
      {
        target: Range.prototype,
        key: 'getClientRects',
        value: () => Object.assign([], { item: () => null })
      },
      {
        target: Range.prototype,
        key: 'getBoundingClientRect',
        value: () => new DOMRect()
      },
      {
        target: Document.prototype,
        key: 'elementFromPoint',
        value: () => null
      }
    ]
    const restore: (() => void)[] = []
    for (const { target, key, value } of fallbacks) {
      if (Reflect.get(target, key) != null) continue
      const descriptor = Object.getOwnPropertyDescriptor(target, key)
      Object.defineProperty(target, key, {
        configurable: true,
        writable: true,
        value
      })
      restore.push(() => {
        if (descriptor) Object.defineProperty(target, key, descriptor)
        else Reflect.deleteProperty(target, key)
      })
    }
    return () => {
      for (const restoreProperty of restore) restoreProperty()
    }
  })
}
