import { describe, expect, it } from 'vitest'

import type { GpuSessionState } from '@/platform/workspace/gpuSession'
import {
  INITIAL_GPU_SESSION,
  parseGpuSessionMessage,
  readEditorGpuSettings,
  readGpuStartingBody,
  reduceGpuSession
} from '@/platform/workspace/gpuSession'

const DEPLOYMENT = 'dep-1'

const starting: GpuSessionState = {
  changed: { on: true },
  gpu: 'starting',
  session: null
}

function receive(state: GpuSessionState, detail: unknown) {
  const message = parseGpuSessionMessage(detail)
  if (!message) throw new Error('not a gpu_session message')
  return reduceGpuSession(state, {
    type: 'messageReceived',
    message,
    deploymentId: DEPLOYMENT
  })
}

describe('gpu_session messages', () => {
  it('marks the GPU ready and keeps the machine it names', () => {
    const next = receive(starting, {
      session_id: 's-1',
      deployment_id: DEPLOYMENT,
      state: 'ready',
      requests: 2,
      machine: { hostname: 'gpu-host', gpu_name: 'L40S', comfyui_pid: 7 },
      runs: [{ job_id: 'job-1', status: 'success', same_machine: true }]
    })

    expect(next.gpu).toBe('ready')
    expect(next.changed.on).toBe(true)
    expect(next.session?.machine).toEqual({
      hostname: 'gpu-host',
      gpu_name: 'L40S',
      comfyui_pid: 7
    })
    expect(next.session?.runs).toEqual([
      { job_id: 'job-1', status: 'success', same_machine: true }
    ])
  })

  it.for([
    { reason: 'idle', on: false },
    { reason: 'tab_closed', on: false },
    { reason: 'editor_gpu_off', on: false },
    { reason: 'machine_lost', on: true }
  ])(
    'an ended session with reason $reason leaves the toggle on: $on',
    ({ reason, on }) => {
      const next = receive(starting, {
        session_id: 's-1',
        deployment_id: DEPLOYMENT,
        state: 'ended',
        reason
      })

      expect(next.gpu).toBe('idle')
      expect(next.changed.on).toBe(on)
    }
  )

  it('ignores a message for another deployment', () => {
    const next = receive(starting, {
      session_id: 's-2',
      deployment_id: 'dep-other',
      state: 'ready'
    })

    expect(next).toBe(starting)
  })

  it.for([
    { name: 'null', detail: null },
    { name: 'no session id', detail: { state: 'ready' } },
    { name: 'an unknown state', detail: { session_id: 's', state: 'paused' } }
  ])('reads $name as no message', ({ detail }) => {
    expect(parseGpuSessionMessage(detail)).toBeNull()
  })
})

describe('readEditorGpuSettings', () => {
  it('reads nothing from an entry without editor_gpu', () => {
    expect(
      readEditorGpuSettings({ deployment_id: DEPLOYMENT, status: 'ready' })
    ).toBeNull()
  })

  it('fills the idle and close defaults the entry leaves out', () => {
    expect(readEditorGpuSettings({ editor_gpu: false })).toEqual({
      on: false,
      idleMinutes: 10,
      endOnClose: true
    })
  })

  it('reads the idle and close options the entry carries', () => {
    expect(
      readEditorGpuSettings({
        editor_gpu: true,
        editor_gpu_idle_minutes: 0,
        editor_gpu_end_on_close: false
      })
    ).toEqual({ on: true, idleMinutes: 0, endOnClose: false })
  })
})

describe('reduceGpuSession', () => {
  it.for([
    { gpu: 'starting', phase: 'starting' },
    { gpu: null, phase: 'starting' },
    { gpu: 'unavailable', phase: 'unavailable' }
  ] as const)('turning on with gpu $gpu starts at $phase', ({ gpu, phase }) => {
    const next = reduceGpuSession(INITIAL_GPU_SESSION, {
      type: 'changeSaved',
      change: { on: true },
      gpu
    })

    expect(next).toEqual({ changed: { on: true }, gpu: phase, session: null })
  })

  it.for([
    {
      name: 'a gpu_starting answer of off',
      event: { type: 'gpuAnswered', answer: 'off' }
    },
    {
      name: 'an answer of off to turning on',
      event: { type: 'changeSaved', change: { on: true }, gpu: 'off' }
    }
  ] as const)('$name turns the toggle off', ({ event }) => {
    const next = reduceGpuSession(starting, event)

    expect(next.changed.on).toBe(false)
    expect(next.gpu).toBe('idle')
  })

  it.for([
    {
      name: 'a 503 starting answer',
      event: { type: 'gpuAnswered', answer: 'starting' }
    },
    {
      name: 'the acknowledgement of turning on',
      event: { type: 'changeSaved', change: { on: true }, gpu: 'starting' }
    }
  ] as const)(
    '$name that arrives after the socket said ready keeps the GPU ready',
    ({ event }) => {
      const ready = receive(starting, {
        session_id: 's-1',
        deployment_id: DEPLOYMENT,
        state: 'ready',
        runs: []
      })

      const next = reduceGpuSession(ready, event)

      expect(next.gpu).toBe('ready')
      expect(next.changed.on).toBe(true)
    }
  )
})

describe('readGpuStartingBody', () => {
  it.for([
    {
      name: 'a starting GPU',
      body: { code: 'gpu_starting', gpu: 'starting' },
      answer: 'starting'
    },
    {
      name: 'a toggle turned off',
      body: { code: 'gpu_starting', gpu: 'off' },
      answer: 'off'
    },
    {
      name: 'no gpu field',
      body: { code: 'gpu_starting' },
      answer: 'unavailable'
    },
    { name: 'another error', body: { code: 'other' }, answer: null }
  ])('reads $name as $answer', ({ body, answer }) => {
    expect(readGpuStartingBody(body)).toBe(answer)
  })
})
