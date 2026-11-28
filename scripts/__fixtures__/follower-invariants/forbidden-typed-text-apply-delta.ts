import type * as Y from 'yjs'

export function edit(text: Y.Text): void {
  text.applyDelta([{ insert: 'x' }])
}
