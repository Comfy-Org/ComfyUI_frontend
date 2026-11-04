import { PromptExecutionError } from '@comfyorg/api-client/ComfyApi'
import type { JobDetail } from '@comfyorg/api-client/jobTypes'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@comfyorg/graph-model/workflowSchema'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { t } from '@/i18n'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { createAppExecutor } from '@/renderer/extensions/superComfy/apps/appExecutor'
import type { AppHooks } from '@/renderer/extensions/superComfy/apps/appTestFixtures'
import {
  APP_ROOT_ID,
  registerAppNodeTypes,
  savedAppJson,
  serveUserData,
  storeSavedApp
} from '@/renderer/extensions/superComfy/apps/appTestFixtures'
import type {
  AppNode,
  MediaItem
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import type {
  RunOutcome,
  RunRequest
} from '@/renderer/extensions/superComfy/engine/types'
import {
  persistBlob,
  readItemBytes
} from '@/renderer/extensions/superComfy/media/superMedia'
import { api } from '@/scripts/api'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'
import { useExecutionStore } from '@/stores/executionStore'

vi.mock(import('firebase/auth'))
vi.mock(import('@/renderer/extensions/superComfy/media/superMedia'), {
  spy: true
})

interface QueuedPrompt {
  output: ComfyApiWorkflow
  workflow: ComfyWorkflowJSON
  targets: readonly string[] | undefined
}

async function setupApp(
  options: { hooks?: AppHooks; extraTypes?: readonly string[] } = {}
) {
  registerAppNodeTypes(options.hooks)
  const appJson = await savedAppJson(options.extraTypes)
  const workflow = storeSavedApp(appJson)
  const node: AppNode = {
    id: 'app-1',
    kind: 'app',
    x: 0,
    y: 0,
    width: 280,
    runCount: 1,
    settingsOpen: false,
    values: {},
    inline: {},
    runs: {},
    result: null,
    workflowPath: workflow.path,
    title: 'Portrait',
    contract: {
      version: 1000,
      inputs: [
        {
          name: 'in:1:image',
          label: 'Photo',
          modality: 'image',
          required: true,
          multi: false,
          target: { nodeId: '1', widgetName: 'image' }
        },
        {
          name: 'in:2:text',
          label: 'Prompt',
          modality: 'text',
          required: false,
          multi: false,
          inline: true,
          target: { nodeId: '2', widgetName: 'text' }
        }
      ],
      outputs: [
        {
          name: 'out:4',
          label: 'Preview',
          modality: 'image',
          required: false,
          multi: false,
          outputNodeId: '4'
        }
      ],
      settings: [],
      dropped: 0
    }
  }
  return { node, appJson }
}

function inputFile(filename: string): MediaItem {
  return {
    kind: 'file',
    modality: 'image',
    ref: { filename, subfolder: '', type: 'input' }
  }
}

function runRequest(
  node: AppNode,
  index: number,
  inputs: Record<string, MediaItem[]>,
  signal: AbortSignal = new AbortController().signal
): RunRequest {
  return {
    node,
    run: { index, repeat: 0, key: `run-${index}`, inputs },
    signal,
    onProgress: () => undefined
  }
}

function completedJob(id: string, filenames: readonly string[]): JobDetail {
  return {
    id,
    status: 'completed',
    create_time: 0,
    outputs_count: filenames.length,
    previewable_outputs_count: filenames.length,
    outputs: {
      '4': {
        images: filenames.map((filename) => ({
          filename,
          subfolder: 'supercomfy',
          type: 'output'
        }))
      }
    }
  }
}

function recordQueuedPrompts(): QueuedPrompt[] {
  const queued: QueuedPrompt[] = []
  vi.spyOn(api, 'queuePrompt').mockImplementation(
    async (_number, prompt, options) => {
      queued.push({ ...prompt, targets: options?.partialExecutionTargets })
      return { prompt_id: `job-${queued.length}` }
    }
  )
  return queued
}

async function runAll(
  node: AppNode,
  requests: readonly RunRequest[]
): Promise<RunOutcome[]> {
  const execution = createAppExecutor().begin(
    node,
    new AbortController().signal
  )
  const outcomes = await Promise.all(
    requests.map((request) => execution.run(request))
  )
  await execution.dispose()
  return outcomes
}

beforeEach(() => {
  vi.mocked(useTeamWorkspaceStore().waitForWorkspaceSwitch).mockResolvedValue()
  Object.assign(useTeamWorkspaceStore(), {
    activeWorkspaceId: 'workspace-a',
    workspaceTransitionGeneration: 0
  })
  vi.mocked(useAuthStore().getWorkspaceAuthToken).mockResolvedValue(
    'workspace-token'
  )
  useAuthStore().currentUser = null
  vi.mocked(useApiKeyAuthStore().getApiKey).mockReturnValue(null)
  vi.spyOn(api, 'cancelJob').mockResolvedValue()
  vi.spyOn(api, 'interrupt').mockResolvedValue()
  vi.spyOn(api, 'getJobDetail').mockImplementation(async (id) =>
    completedJob(id, [`${id}.png`])
  )
})

describe('createAppExecutor', () => {
  it('returns every output file of each run under its output port', async () => {
    const { node } = await setupApp()
    recordQueuedPrompts()
    vi.mocked(api.getJobDetail).mockImplementation(async (id) =>
      completedJob(id, [`${id}-a.png`, `${id}-b.png`])
    )

    const outcomes = await runAll(node, [
      runRequest(node, 0, { 'in:1:image': [inputFile('cat.png')] }),
      runRequest(node, 1, { 'in:1:image': [inputFile('dog.png')] })
    ])

    const output = (filename: string) => ({
      kind: 'file',
      modality: 'image',
      ref: { filename, subfolder: 'supercomfy', type: 'output' }
    })
    expect(outcomes).toEqual([
      {
        ok: true,
        outputs: { 'out:4': [output('job-1-a.png'), output('job-1-b.png')] }
      },
      {
        ok: true,
        outputs: { 'out:4': [output('job-2-a.png'), output('job-2-b.png')] }
      }
    ])
  })

  it('queues the bound inputs, saves previews and runs only the app outputs', async () => {
    const { node } = await setupApp()
    const queued = recordQueuedPrompts()

    await runAll(node, [
      runRequest(node, 0, {
        'in:1:image': [inputFile('cat.png')],
        'in:2:text': [{ kind: 'text', text: 'a red fox' }]
      })
    ])

    const [prompt] = queued
    assert.exists(prompt)
    expect(prompt.output['1'].inputs.image).toBe('cat.png')
    expect(prompt.output['2'].inputs.text).toBe('a red fox')
    expect(prompt.output['4'].class_type).toBe('SaveImage')
    expect(prompt.output['4'].inputs.filename_prefix).toMatch(
      /^supercomfy\/run_[0-9a-f]{8}$/
    )
    expect(prompt.targets).toEqual(['4'])
    expect(prompt.workflow.id).toBe(APP_ROOT_ID)
  })

  it('advances the seed once per run, in run order', async () => {
    const { node } = await setupApp()
    const queued = recordQueuedPrompts()

    await runAll(node, [
      runRequest(node, 0, {
        'in:1:image': [inputFile('cat.png')],
        'in:2:text': [{ kind: 'text', text: 'first' }]
      }),
      runRequest(node, 1, {
        'in:1:image': [inputFile('cat.png')],
        'in:2:text': [{ kind: 'text', text: 'second' }]
      })
    ])

    expect(
      queued.map(({ output }) => [
        output['2'].inputs.text,
        output['3'].inputs.seed
      ])
    ).toEqual([
      ['first', 1],
      ['second', 2]
    ])
  })

  it('routes the job to the app before its afterQueued hooks, so the open canvas is never painted', async () => {
    const canvasPath = 'workflows/canvas.json'
    const ownedByCanvas: boolean[] = []
    const { node, appJson } = await setupApp({
      hooks: {
        afterQueued: () =>
          ownedByCanvas.push(
            useExecutionStore().belongsToActiveWorkflow('job-1')
          )
      }
    })
    serveUserData({ [node.workflowPath]: appJson, [canvasPath]: appJson })
    useWorkflowStore().activeWorkflow = await new ComfyWorkflow({
      path: canvasPath,
      modified: 1,
      size: 1
    }).load()
    recordQueuedPrompts()

    await runAll(node, [
      runRequest(node, 0, { 'in:1:image': [inputFile('cat.png')] })
    ])

    expect(ownedByCanvas).toEqual([false])
    expect(useExecutionStore().belongsToActiveWorkflow('job-1')).toBe(false)
  })

  it('fails without submitting when the workspace changed while signing in', async () => {
    const { node } = await setupApp()
    const queued = recordQueuedPrompts()
    vi.mocked(useAuthStore().getWorkspaceAuthToken).mockImplementation(
      async () => {
        Object.assign(useTeamWorkspaceStore(), {
          activeWorkspaceId: 'workspace-b'
        })
        return 'workspace-token'
      }
    )

    const outcomes = await runAll(node, [
      runRequest(node, 0, { 'in:1:image': [inputFile('cat.png')] })
    ])

    expect(outcomes).toEqual([
      { ok: false, message: t('superComfy.app.workspaceChanged') }
    ])
    expect(queued).toEqual([])
  })

  it('fails with the server message and the first node error', async () => {
    const { node } = await setupApp()
    vi.spyOn(api, 'queuePrompt').mockRejectedValue(
      new PromptExecutionError(
        {
          error: {
            type: 'prompt_outputs_failed_validation',
            message: 'Prompt outputs failed validation'
          },
          node_errors: {
            '3': {
              errors: [
                { type: 'value_not_in_list', message: 'Value not in list' }
              ],
              class_type: 'KSampler',
              dependent_outputs: []
            }
          }
        },
        400
      )
    )

    const outcomes = await runAll(node, [
      runRequest(node, 0, { 'in:1:image': [inputFile('cat.png')] })
    ])

    expect(outcomes).toEqual([
      {
        ok: false,
        message: 'Prompt outputs failed validation (Sampler: Value not in list)'
      }
    ])
  })

  it('fails on missing node types without submitting', async () => {
    const { node } = await setupApp({ extraTypes: ['CustomUpscaler'] })
    const queued = recordQueuedPrompts()

    const outcomes = await runAll(node, [
      runRequest(node, 0, { 'in:1:image': [inputFile('cat.png')] })
    ])

    expect(outcomes).toEqual([
      {
        ok: false,
        message: t('superComfy.app.missingNodes', { nodes: 'CustomUpscaler' })
      }
    ])
    expect(queued).toEqual([])
  })

  it('cancels the queued job when the run is stopped', async () => {
    const { node } = await setupApp()
    recordQueuedPrompts()
    vi.mocked(api.getJobDetail).mockImplementation(async (id) => ({
      ...completedJob(id, []),
      status: 'pending'
    }))
    const controller = new AbortController()
    const execution = createAppExecutor().begin(node, controller.signal)
    const outcome = execution.run(
      runRequest(
        node,
        0,
        { 'in:1:image': [inputFile('cat.png')] },
        controller.signal
      )
    )
    await vi.waitFor(() => expect(api.getJobDetail).toHaveBeenCalled())

    controller.abort()

    await expect(outcome).resolves.toMatchObject({ ok: false })
    expect(api.cancelJob).toHaveBeenCalledWith('job-1')
    await execution.dispose()
  })

  it('re-hosts a link input before binding it', async () => {
    const { node } = await setupApp()
    const queued = recordQueuedPrompts()
    vi.mocked(readItemBytes).mockResolvedValue({
      ok: true,
      blob: new Blob(['png'])
    })
    vi.mocked(persistBlob).mockResolvedValue({
      ok: true,
      item: inputFile('rehosted.png')
    })

    await runAll(node, [
      runRequest(node, 0, {
        'in:1:image': [
          {
            kind: 'link',
            modality: 'image',
            url: 'https://cdn.example/out/fox.png',
            expiresAt: Number.MAX_SAFE_INTEGER
          }
        ]
      })
    ])

    expect(queued.map(({ output }) => output['1'].inputs.image)).toEqual([
      'rehosted.png'
    ])
  })

  it('fails the run when a link input has expired', async () => {
    const { node } = await setupApp()
    const queued = recordQueuedPrompts()
    vi.mocked(readItemBytes).mockResolvedValue({ ok: false, reason: 'expired' })

    const outcomes = await runAll(node, [
      runRequest(node, 0, {
        'in:1:image': [
          {
            kind: 'link',
            modality: 'image',
            url: 'https://cdn.example/out/fox.png',
            expiresAt: 0
          }
        ]
      })
    ])

    expect(outcomes).toEqual([
      { ok: false, message: t('superComfy.media.expired') }
    ])
    expect(queued).toEqual([])
  })
})
