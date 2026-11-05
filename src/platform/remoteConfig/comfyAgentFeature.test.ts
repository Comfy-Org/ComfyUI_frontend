import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { isComfyAgentReady, readComfyAgentFeature } from './comfyAgentFeature'

vi.mock(import('@/scripts/api'))

function serve(agent: unknown): void {
  vi.mocked(api.getServerFeature).mockImplementation(
    <T>(name: string, fallback?: T) =>
      (name === 'agent' ? agent : fallback)
  )
}

describe('readComfyAgentFeature', () => {
  it.for([undefined, null, {}, { state: 'stopped' }, { state: 1 }])(
    'ignores a feature without a known state: %j',
    (agent) => {
      serve(agent)

      expect(readComfyAgentFeature()).toBeUndefined()
      expect(isComfyAgentReady()).toBe(false)
    }
  )

  it('returns a known feature as served', () => {
    const agent = { state: 'failed', reason: 'port in use' }
    serve(agent)

    expect(readComfyAgentFeature()).toBe(agent)
    expect(isComfyAgentReady()).toBe(false)
  })

  it('drops a reason that is not a string', () => {
    serve({ state: 'ready', reason: { code: 7 } })

    expect(readComfyAgentFeature()).toEqual({ state: 'ready' })
    expect(isComfyAgentReady()).toBe(true)
  })

  it("ignores ComfyUI's agent in the standalone harness", () => {
    vi.stubEnv('VITE_AGENT_STANDALONE', 'true')
    serve({ state: 'ready' })

    expect(readComfyAgentFeature()).toBeUndefined()
    expect(isComfyAgentReady()).toBe(false)
  })
})
