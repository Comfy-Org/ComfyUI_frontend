import * as Y from 'yjs'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

export function getLayoutStoreYDoc(): Y.Doc {
  const ydoc: unknown = Reflect.get(layoutStore, 'ydoc')
  if (ydoc instanceof Y.Doc) return ydoc
  throw new Error('Layout store Y.Doc is unavailable')
}
