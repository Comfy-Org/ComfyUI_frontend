import { expect, it } from 'vitest'

import {
  awarenessFrame,
  docOpsResultFrame,
  docUpdateFrame
} from './__fixtures__/docFrameClient'
import { parseServerDocFrame } from './docFrameClient'

it.for([
  [
    'workflow UTF-8 bytes',
    (extra: number) =>
      docUpdateFrame({ workflow_id: 'é'.repeat(64) + 'x'.repeat(extra) })
  ],
  [
    'actor UTF-8 bytes',
    (extra: number) =>
      awarenessFrame({ actor: 'é'.repeat(128) + 'x'.repeat(extra) })
  ],
  [
    'operation ID UTF-8 bytes',
    (extra: number) =>
      docUpdateFrame({ op_ids: ['é'.repeat(64) + 'x'.repeat(extra)] })
  ],
  [
    'operation count',
    (extra: number) =>
      docOpsResultFrame({
        applied: Array.from({ length: 256 + extra }, () => 'op')
      })
  ],
  [
    'error code UTF-8 bytes',
    (extra: number) =>
      docOpsResultFrame({ code: 'é'.repeat(64) + 'x'.repeat(extra) })
  ],
  [
    'error message UTF-8 bytes',
    (extra: number) =>
      docOpsResultFrame({ message: 'é'.repeat(4096) + 'x'.repeat(extra) })
  ],
  [
    'awareness JSON bytes',
    (extra: number) =>
      awarenessFrame({ state: { value: 'é'.repeat(4090) + 'x'.repeat(extra) } })
  ],
  [
    'encoded update length',
    (extra: number) =>
      docUpdateFrame({ update_b64: 'AAAA'.repeat((8 << 20) / 4 + extra) })
  ]
] as const)('enforces the inclusive %s cap', ([_name, frame]) => {
  expect(parseServerDocFrame(frame(0))).not.toBeNull()
  expect(parseServerDocFrame(frame(1))).toBeNull()
})

it('converts generated bigint sequences without losing precision', () => {
  expect(
    parseServerDocFrame(
      docUpdateFrame({ seq: BigInt(Number.MAX_SAFE_INTEGER) })
    )?.data
  ).toMatchObject({ seq: Number.MAX_SAFE_INTEGER })
  expect(
    parseServerDocFrame(
      docUpdateFrame({ seq: BigInt(Number.MAX_SAFE_INTEGER) + 1n })
    )
  ).toBeNull()
  expect(parseServerDocFrame(docUpdateFrame({ seq: -1 }))).toBeNull()
})
