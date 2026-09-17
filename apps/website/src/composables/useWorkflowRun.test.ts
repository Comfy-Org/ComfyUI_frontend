import { computed, defineComponent, h, nextTick, shallowRef } from 'vue'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkflowJob } from '../config/workflow-execution'
import * as workflowExecution from '../config/workflow-execution'
import type { WorkshopSession } from '../config/workshop-session-state'
import { useWorkflowRun } from './useWorkflowRun'

const transport = vi.hoisted(() => ({
  upload: vi.fn(),
  submit: vi.fn(),
  read: vi.fn(),
  outputs: vi.fn(),
  outputFile: vi.fn(),
  cancel: vi.fn()
}))
function credential(): WorkshopSession {
  return {
    uid: 'person',
    workspace: { id: 'personal', name: 'Personal', type: 'personal' },
    token: 'test-token',
    expiresAt: Date.now() + 60_000,
    role: 'owner',
    permissions: []
  }
}
const auth = shallowRef(credential())
vi.mock(import('../config/workshop-session-state'), () => ({
  useWorkshopSession: () => ({
    user: computed(() => null),
    session: computed(() => auth.value),
    sessionFailure: computed(() => undefined),
    settled: computed(() => true),
    signedIn: computed(() => true),
    ensureFresh: async () => ({ status: 'ok', session: auth.value }),
    remint: async () => ({ status: 'ok', session: auth.value }),
    signOut: async () => {}
  })
}))
vi.mock(import('../config/workshop-credits'), () => ({
  refreshWorkshopCredits: vi.fn()
}))

const completed: WorkflowJob = {
  id: 'job-1',
  status: 'completed',
  create_time: 1n,
  update_time: 2n
}
function setup(requireMask = false) {
  let runner: ReturnType<typeof useWorkflowRun> | undefined
  const wrapper = render(
    defineComponent({
      setup() {
        runner = useWorkflowRun(
          {
            slug: 'test',
            template: 'test',
            title: 'Test',
            category: 'Edit & clean up photos',
            description: 'Test',
            fields: requireMask
              ? [
                  {
                    node: '2',
                    input: 'image',
                    kind: 'image',
                    label: 'Edit mask'
                  }
                ]
              : [{ node: '1', input: 'text', kind: 'text', label: 'Prompt' }]
          },
          {
            '1': { class_type: 'CLIPTextEncode', inputs: { text: 'example' } },
            '2': {
              class_type: 'LoadImageMask',
              inputs: { image: '', channel: 'red' }
            }
          }
        )
        return () => h('div')
      }
    })
  )
  if (!runner) throw new Error('Runner did not mount')
  return { runner, wrapper }
}

beforeEach(() => {
  auth.value = credential()
  vi.spyOn(workflowExecution, 'createWorkflowClient').mockReturnValue(transport)
  transport.submit.mockResolvedValue('job-1')
  transport.read.mockResolvedValue(completed)
  transport.outputs.mockResolvedValue({ assets: [] })
})

describe('workflow run lifecycle', () => {
  it('requires a mask before uploading or submitting, then binds the uploaded mask', async () => {
    const { runner } = setup(true)
    await runner.run()
    expect(runner.state.value).toMatchObject({
      phase: 'error',
      message: 'Upload edit mask before running.',
      retrySafe: true
    })
    expect(transport.upload).not.toHaveBeenCalled()
    expect(transport.submit).not.toHaveBeenCalled()
    transport.upload.mockResolvedValue('uploaded-mask.png')
    runner.selectFile(
      '2.image',
      new File(['mask'], 'mask.png', { type: 'image/png' })
    )
    await runner.run()
    expect(transport.submit.mock.calls[0][0]['2'].inputs.image).toBe(
      'uploaded-mask.png'
    )
    expect(runner.state.value.phase).toBe('finished')
  })
  it('submits edited inputs and waits for real outputs before enabling another run', async () => {
    let release: ((value: { assets: [] }) => void) | undefined
    transport.outputs.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )
    const { runner, wrapper } = setup()
    runner.values.value['1.text'] = 'my edited prompt'
    const pending = runner.run()
    await vi.waitFor(() => expect(transport.outputs).toHaveBeenCalled())
    expect(transport.submit.mock.calls[0][0]['1'].inputs.text).toBe(
      'my edited prompt'
    )
    expect(runner.busy.value).toBe(true)
    await runner.run()
    expect(transport.submit).toHaveBeenCalledTimes(1)
    release?.({ assets: [] })
    await pending
    expect(runner.state.value.phase).toBe('finished')
    expect(runner.outputs.value).toEqual([])
    wrapper.unmount()
  })
  it('reconnects to the same job after a polling failure without resubmitting', async () => {
    transport.read.mockRejectedValueOnce(new Error('Disconnected'))
    const { runner, wrapper } = setup()
    await runner.run()
    expect(runner.state.value).toMatchObject({ phase: 'error', jobId: 'job-1' })
    await runner.resume()
    expect(transport.submit).toHaveBeenCalledTimes(1)
    expect(runner.state.value.phase).toBe('finished')
    wrapper.unmount()
  })
  it('discards late results after a workspace change', async () => {
    let release: ((value: WorkflowJob) => void) | undefined
    transport.read.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )
    const { runner, wrapper } = setup()
    const pending = runner.run()
    await vi.waitFor(() => expect(transport.read).toHaveBeenCalled())
    auth.value = {
      ...auth.value,
      workspace: { ...auth.value.workspace, id: 'another-workspace' }
    }
    await nextTick()
    release?.(completed)
    await pending
    expect(runner.state.value.phase).toBe('idle')
    expect(transport.outputs).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('blocks a second submission when the first response was lost', async () => {
    transport.submit.mockRejectedValue(new TypeError('Network error'))
    const { runner, wrapper } = setup()
    await runner.run()
    expect(runner.state.value).toMatchObject({
      phase: 'error',
      retrySafe: false
    })
    await runner.run()
    expect(transport.submit).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
