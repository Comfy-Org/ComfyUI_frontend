import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

const COLLECTIONS = ['inputs', 'outputs', 'widgets'] as const

/** `node.hasOwnProperty(key)`, without tripping no-prototype-builtins. */
function hasOwn(node: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(node, key)
}

function expectOwnAccessor(node: object, key: string): void {
  expect(hasOwn(node, key), `hasOwnProperty(${key})`).toBe(true)
  const descriptor = Object.getOwnPropertyDescriptor(node, key)
  expect(descriptor?.enumerable, `${key} enumerable`).toBe(true)
  expect(typeof descriptor?.get, `${key} getter`).toBe('function')
  expect('value' in (descriptor ?? {}), `${key} is a data property`).toBe(false)
}

describe('LGraphNode own collection fields', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('exposes the collections to shell introspection on a bare node', () => {
    const node = new LGraphNode('Bare')

    for (const key of COLLECTIONS) expectOwnAccessor(node, key)
    expect(Object.keys(node)).toEqual(expect.arrayContaining([...COLLECTIONS]))

    const enumerated: string[] = []
    for (const key in node) enumerated.push(key)
    expect(enumerated).toEqual(expect.arrayContaining([...COLLECTIONS]))
  })

  it('keeps the fields own on a subclass', () => {
    class PackNode extends LGraphNode {
      constructor() {
        super('Pack node')
        this.addInput('in', 'INT')
      }
    }

    for (const key of COLLECTIONS) expectOwnAccessor(new PackNode(), key)
  })

  it('hands introspection the live collection, not a copy', () => {
    const node = new LGraphNode('Forwarding')
    node.addInput('prompt', 'STRING')

    const [input] = node.inputs
    input.label = 'Translated prompt'

    expect(node.getInputInfo(0)?.label).toBe('Translated prompt')
    expect(node.inputs).toBe(node.inputs)
  })

  it('keeps the fields own after configure restores serialized data', () => {
    const source = new LGraphNode('Serialized')
    source.addInput('prompt', 'STRING')
    source.addOutput('result', 'STRING')
    source.addWidget('text', 'prompt', '', () => undefined)

    const restored = new LGraphNode('Serialized')
    restored.configure(source.serialize())

    for (const key of COLLECTIONS) expectOwnAccessor(restored, key)
    expect(restored.inputs).toHaveLength(1)
    expect(restored.outputs).toHaveLength(1)
  })
})
