import * as fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { convertContextMenuToOptions } from './contextMenuConverter'

interface InvocationRecord {
  this: unknown
  args: unknown[]
}

function makeFakeNode(id: number): LGraphNode {
  return { id, isFakeNode: true } as unknown as LGraphNode
}

const arbItemContent = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,40}$/)
  .filter(
    (s) =>
      !['Properties', 'Title', 'Mode', 'Properties Panel'].includes(s) &&
      !s.startsWith('Copy (') &&
      s !== 'Collapse' &&
      s !== 'Expand' &&
      s !== 'Colors' &&
      s !== 'Shapes'
  )

describe('convertContextMenuToOptions callback wrapping (property)', () => {
  it('forwards the LGraphNode passed to convertContextMenuToOptions as the 5th arg of every callback', () => {
    fc.assert(
      fc.property(arbItemContent, fc.integer(), (content, nodeId) => {
        const invocations: InvocationRecord[] = []
        const callback = vi.fn(function (this: unknown, ...args: unknown[]) {
          invocations.push({ this: this, args })
        })

        const node = makeFakeNode(nodeId)
        const options = convertContextMenuToOptions(
          [{ content, callback }],
          node,
          false
        )

        const target = options.find((opt) => opt.label === content)
        expect(target, `Item "${content}" should be in result`).toBeDefined()
        expect(
          target?.action,
          `Item "${content}" should be invokable`
        ).toBeTypeOf('function')

        target?.action?.()

        expect(callback).toHaveBeenCalledOnce()
        expect(invocations).toHaveLength(1)
        expect(
          invocations[0].args[4],
          'Wrapper must forward the LGraphNode as the 5th argument'
        ).toBe(node)
      })
    )
  })

  it('passes undefined as the 5th arg when no node is provided', () => {
    fc.assert(
      fc.property(arbItemContent, (content) => {
        const invocations: InvocationRecord[] = []
        const callback = vi.fn(function (this: unknown, ...args: unknown[]) {
          invocations.push({ this: this, args })
        })

        const options = convertContextMenuToOptions(
          [{ content, callback }],
          undefined,
          false
        )

        const target = options.find((opt) => opt.label === content)
        target?.action?.()

        expect(invocations).toHaveLength(1)
        expect(invocations[0].args[4]).toBeUndefined()
      })
    )
  })

  it('forwards item.value as the 1st arg', () => {
    fc.assert(
      fc.property(arbItemContent, fc.anything(), (content, value) => {
        const invocations: InvocationRecord[] = []
        const callback = vi.fn(function (this: unknown, ...args: unknown[]) {
          invocations.push({ this: this, args })
        })

        const options = convertContextMenuToOptions(
          [{ content, value, callback }],
          makeFakeNode(0),
          false
        )

        const target = options.find((opt) => opt.label === content)
        target?.action?.()

        expect(invocations).toHaveLength(1)
        expect(invocations[0].args[0]).toStrictEqual(value)
      })
    )
  })

  it('survives callbacks that throw without breaking subsequent items', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(arbItemContent, { minLength: 2, maxLength: 6 }),
        (contents) => {
          const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {})

          const calls: string[] = []
          const items = contents.map((content, idx) => ({
            content,
            callback: () => {
              calls.push(content)
              if (idx === 0) throw new Error('boom')
            }
          }))

          const options = convertContextMenuToOptions(
            items,
            makeFakeNode(1),
            false
          )

          for (const opt of options) opt.action?.()

          expect(calls).toEqual(contents)
          errorSpy.mockRestore()
        }
      )
    )
  })
})
