import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useResultDownload } from './useResultDownload'

type Phase =
  | { kind: 'idle' }
  | { kind: 'done'; result: { url: string; format: string } }

describe('useResultDownload', () => {
  it.for([
    { phase: { kind: 'idle' }, name: 'photo.jpg', file: undefined },
    {
      phase: { kind: 'done', result: { url: 'blob:x', format: 'png' } },
      name: undefined,
      file: undefined
    },
    {
      phase: { kind: 'done', result: { url: 'blob:x', format: 'png' } },
      name: 'photo',
      file: { href: 'blob:x', name: 'photo.png' }
    }
  ] satisfies { phase: Phase; name?: string; file?: object }[])(
    'offers $file for a $phase.kind phase named $name',
    ({ phase, name, file }) => {
      const download = useResultDownload(
        ref<Phase>(phase),
        ({ result }) => name && `${name}.${result.format}`
      )

      expect(download.value).toEqual(file)
    }
  )
})
