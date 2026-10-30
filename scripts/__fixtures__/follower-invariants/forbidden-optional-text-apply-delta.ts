import type * as Y from 'yjs'

export function edit(sharedText: Y.Text | undefined): void {
  if (sharedText) sharedText.applyDelta([{ insert: 'x' }])
}
