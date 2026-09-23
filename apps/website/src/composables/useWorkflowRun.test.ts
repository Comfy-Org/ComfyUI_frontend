import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

import type { AccountCredential } from '@comfyorg/account-core/session'
import {
  zJobAssetsResponse,
  zJobCancelResponse,
  zJobDetailResponse
} from '@comfyorg/ingest-types/zod'

import * as workflowExecution from '../config/workflow-execution'
import { useWorkshopSession } from '../config/workshop-session-state'

const JOB_ID = '11111111-2222-3333-4444-555555555555'

const job = (status: string) =>
  zJobDetailResponse.parse({
    id: JOB_ID,
    status,
    create_time: 0n,
    update_time: 0n
  })

/** Let every promise already queued run before looking at the result. */
const settle = async () => {
  for (let turn = 0; turn < 8; turn += 1) {
    await Promise.resolve()
    await nextTick()
  }
}

const client = {
  upload: vi.fn(() => Promise.resolve('mine.png')),
  submit: vi.fn(() => Promise.resolve(JOB_ID)),
  read: vi.fn(() => Promise.resolve(job('completed'))),
  outputs: vi.fn(() =>
    Promise.resolve(
      zJobAssetsResponse.parse({
        assets: [],
        job_id: JOB_ID,
        pagination: { total: 0, limit: 500, offset: 0, has_more: false }
      })
    )
  ),
  outputFile: vi.fn(() => Promise.resolve(new Blob())),
  cancel: vi.fn(() => Promise.resolve(zJobCancelResponse.parse({})))
} satisfies ReturnType<typeof workflowExecution.createWorkflowClient>

const credential: AccountCredential = {
  token: 't',
  expiresAt: Date.now() + 60_000,
  uid: 'u1',
  workspace: { id: 'w1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: []
}

const session = ref<AccountCredential | undefined>(credential)

// Everything but the client is the real module: the binding of answers into
// the graph is what the submitted workflow is asserted on.
vi.mock(import('../config/workflow-execution'), { spy: true })

vi.mock(import('../config/workshop-session-state'))

vi.mock(import('../config/workshop-credits'))

const { useWorkflowRun } = await import('./useWorkflowRun')

const graph = {
  '1': { class_type: 'LoadImage', inputs: { image: 'example.png' } }
}

const imageField = [
  { node: '1', input: 'image', label: 'Your image', kind: 'image' as const }
]

/** A file the reader picked, in the shape the upload control hands back. */
const chosen = (name: string) => {
  const file = new File(['x'], name, { type: 'image/png' })
  return { name, size: file.size, type: file.type, file }
}

describe('useWorkflowRun', () => {
  beforeEach(() => {
    vi.spyOn(workflowExecution, 'createWorkflowClient').mockReturnValue(client)
    client.read.mockResolvedValue(job('completed'))
    session.value = credential
    const state = useWorkshopSession()
    state.session = computed(() => session.value)
    vi.mocked(state.ensureFresh).mockImplementation(() =>
      Promise.resolve(
        session.value ? { status: 'ok', session: session.value } : undefined
      )
    )
  })

  // The example the template ships with is what the field is filled with, so
  // pressing Run without choosing anything still has something to send.
  it('sends the example when the reader chose nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(new Blob())))
    )
    const run = useWorkflowRun(imageField, graph)

    await run.run()
    await settle()

    expect(client.upload).toHaveBeenCalled()
    expect(client.submit).toHaveBeenCalled()
    expect(run.state.value.phase).toBe('finished')
  })

  it('sends the file the reader chose instead', async () => {
    const run = useWorkflowRun(imageField, graph)
    run.files.value['1.image'] = chosen('mine.png')

    await run.run()
    await settle()

    expect(client.upload).toHaveBeenCalledOnce()
  })

  // A file too big for Cloud is a wasted upload and a wasted wait, so it is
  // refused here rather than by the server three minutes later.
  it('refuses a file Cloud will not take', async () => {
    const run = useWorkflowRun(imageField, graph)
    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 200 * 1024 * 1024 })
    run.files.value['1.image'] = {
      name: big.name,
      size: big.size,
      type: big.type,
      file: big
    }

    await run.run()

    expect(run.state.value).toMatchObject({
      phase: 'error',
      reason: 'validation',
      message: expect.stringMatching(/smaller than 100 MB/i)
    })
    expect(client.submit).not.toHaveBeenCalled()
  })

  it('will not start a second run over one already going', async () => {
    client.read.mockResolvedValue(job('in_progress'))
    const run = useWorkflowRun(imageField, graph)
    run.files.value['1.image'] = chosen('a.png')

    void run.run()
    await settle()
    await run.run()

    expect(client.submit).toHaveBeenCalledOnce()
  })

  it('does nothing at all until somebody is signed in', async () => {
    session.value = undefined
    const run = useWorkflowRun(imageField, graph)

    await run.run()

    expect(run.state.value.phase).toBe('idle')
    expect(client.upload).not.toHaveBeenCalled()
  })

  // The example lives with the templates, and a page that cannot reach it
  // says so rather than sending the graph with a filename that resolves to
  // nothing on the other side.
  it('says so when the example input will not load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('', { status: 404 })))
    )
    const run = useWorkflowRun(imageField, graph)

    await run.run()

    expect(run.state.value).toMatchObject({
      phase: 'error',
      reason: 'upload',
      message: expect.stringMatching(/example input could not load/i)
    })
  })

  // A run stopped on purpose is not a failure, and a run that came back
  // failed is over rather than still out there. Neither is "finished".
  it.for([
    { status: 'cancelled', expected: { phase: 'cancelled' } },
    {
      status: 'failed',
      expected: { phase: 'error', reason: 'provider', retrySafe: true }
    }
  ] as const)(
    'reads a $status job as its own outcome',
    async ({ status, expected }) => {
      client.read.mockResolvedValue(job(status))
      const run = useWorkflowRun(imageField, graph)
      run.files.value['1.image'] = chosen('a.png')

      void run.run()
      await settle()

      expect(run.state.value).toMatchObject(expected)
      expect(client.outputs).not.toHaveBeenCalled()
    }
  )

  // What Cloud refused is what the reader is told, and the code it refused
  // with is the only thing that says which refusal it was.
  it.for([
    { status: 402, reason: 'noCredits' },
    { status: 403, reason: 'policy' },
    { status: 503, reason: 'unavailable' }
  ] as const)(
    'carries a $status refusal through as $reason',
    async ({ status, reason }) => {
      client.submit.mockRejectedValueOnce(
        new workflowExecution.WorkflowHttpError(status, undefined)
      )
      const run = useWorkflowRun(imageField, graph)
      run.files.value['1.image'] = chosen('a.png')

      await run.run()
      await settle()

      expect(run.state.value).toMatchObject({ phase: 'error', reason })
    }
  )

  it('sends a number as a number, not as what was typed', async () => {
    const run = useWorkflowRun(
      [{ node: '1', input: 'steps', label: 'Steps', kind: 'number' as const }],
      { '1': { class_type: 'K', inputs: { steps: 20 } } }
    )
    run.values.value['1.steps'] = '30'

    await run.run()
    await settle()

    expect(client.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        '1': expect.objectContaining({ inputs: { steps: 30 } })
      }),
      expect.anything()
    )
  })

  // A run that may already be queued is not something to start a second time
  // on a button press, so the page keeps refusing until it is told otherwise.
  it('will not retry over an error that may have left a job behind', async () => {
    client.submit.mockRejectedValueOnce(new Error('network went away'))
    const run = useWorkflowRun(imageField, graph)
    run.files.value['1.image'] = chosen('a.png')

    await run.run()
    await settle()
    expect(run.state.value.phase).toBe('error')

    vi.clearAllMocks()
    await run.run()
    expect(client.submit).not.toHaveBeenCalled()
  })

  it('asks Cloud to stop the job rather than just forgetting it', async () => {
    client.read.mockResolvedValue(job('in_progress'))
    const run = useWorkflowRun(imageField, graph)
    run.files.value['1.image'] = chosen('a.png')

    void run.run()
    await settle()
    await run.cancel()

    expect(client.cancel).toHaveBeenCalled()
  })
})
