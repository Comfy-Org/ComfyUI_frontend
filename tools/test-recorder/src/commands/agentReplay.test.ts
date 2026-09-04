import { describe, expect, it } from 'vitest'

import { agentReplayInvocation } from './agentReplay'

describe('agentReplayInvocation', () => {
  it('runs the whole replay suite against the default dev server', () => {
    const { args, env } = agentReplayInvocation({})
    expect(args).toEqual([
      'exec',
      'playwright',
      'test',
      'agentConversation',
      '--project=cloud'
    ])
    expect(env).toEqual({
      PLAYWRIGHT_LOCAL: '1',
      PLAYWRIGHT_TEST_URL: 'http://localhost:5173',
      DISTRIBUTION: 'cloud'
    })
  })

  it('narrows to one recorded case, headed, with video, on another server', () => {
    const { args, env } = agentReplayInvocation({
      caseId: 'agent-rec-add-set-delete',
      headed: true,
      video: true,
      url: 'http://127.0.0.1:6207'
    })
    expect(args.slice(-3)).toEqual([
      '-g',
      'agent-rec-add-set-delete',
      '--headed'
    ])
    expect(env.PLAYWRIGHT_TEST_URL).toBe('http://127.0.0.1:6207')
    expect(env.RECORD_VIDEO).toBe('true')
  })
})
