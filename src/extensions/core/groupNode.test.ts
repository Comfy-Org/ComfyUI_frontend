import { describe, expect, it, vi } from 'vitest'

import type { GroupNodeWorkflowData } from '@/lib/litegraph/src/LGraph'

const mockRegisterExtension = vi.hoisted(() => vi.fn())

vi.mock('@/scripts/app', () => ({
  app: {
    registerExtension: mockRegisterExtension
  }
}))

import { GroupNodeConfig } from '@/extensions/core/groupNode'

const createGroupNodeConfig = () =>
  new GroupNodeConfig('Test Group', {
    external: [],
    links: [],
    nodes: []
  } satisfies GroupNodeWorkflowData)

describe('GroupNodeConfig.getInputConfig', () => {
  it('does not infer control_after_generate from seed-like input names', () => {
    const groupNodeConfig = createGroupNodeConfig()
    const node: Parameters<GroupNodeConfig['getInputConfig']>[0] = {
      index: 0,
      type: 'KSampler',
      inputs: [{ name: 'seed' }]
    }
    const config: Parameters<GroupNodeConfig['getInputConfig']>[3] = [
      'INT',
      { min: 0 }
    ]

    const result = groupNodeConfig.getInputConfig(node, 'seed', {}, config)

    expect(result.config).toEqual(['INT', { min: 0 }])
  })

  it('does not add control_prefix when there is no prefix', () => {
    const groupNodeConfig = createGroupNodeConfig()
    const node: Parameters<GroupNodeConfig['getInputConfig']>[0] = {
      index: 0,
      type: 'KSampler',
      inputs: [{ name: 'seed' }]
    }
    const config: Parameters<GroupNodeConfig['getInputConfig']>[3] = [
      'INT',
      { control_after_generate: true, min: 0 }
    ]

    const result = groupNodeConfig.getInputConfig(node, 'seed', {}, config)

    expect(result.config).toEqual([
      'INT',
      { control_after_generate: true, min: 0 }
    ])
  })

  it('falls back to empty object when config[1] is not an object', () => {
    const groupNodeConfig = createGroupNodeConfig()
    const node: Parameters<GroupNodeConfig['getInputConfig']>[0] = {
      index: 0,
      type: 'KSampler'
    }
    const config: Parameters<GroupNodeConfig['getInputConfig']>[3] = ['INT']

    const result = groupNodeConfig.getInputConfig(node, 'steps', {}, config)

    expect(result.config).toEqual(['INT'])
    expect(result.name).toBe('steps')
  })

  it('preserves explicit control_after_generate modes for grouped inputs', () => {
    const groupNodeConfig = createGroupNodeConfig()
    const node: Parameters<GroupNodeConfig['getInputConfig']>[0] = {
      index: 0,
      type: 'KSampler',
      inputs: [{ name: 'seed' }]
    }
    const config: Parameters<GroupNodeConfig['getInputConfig']>[3] = [
      'INT',
      { control_after_generate: 'increment' }
    ]

    const result = groupNodeConfig.getInputConfig(
      node,
      'seed',
      { seed: 1 },
      config
    )

    expect(result.name).toBe('KSampler seed')
    expect(result.config).toEqual([
      'INT',
      {
        control_after_generate: 'increment',
        control_prefix: 'KSampler'
      }
    ])
  })
})
