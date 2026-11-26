import { reportError } from '@comfyorg/telemetry/reportError'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import {
  checkCloudCompatibility,
  readCloudMissingModels
} from '@/platform/openOnCloud/cloudCompatibilityApi'
import { LGraphEventMode, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { app } from '@/scripts/app'
import { useAuthStore } from '@/stores/authStore'
import type { ModelFolder } from '@/stores/modelStore'
import { useModelStore } from '@/stores/modelStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@comfyorg/telemetry/reportError'))

function node(
  comfyClass: string,
  inputs: Record<string, string> = {},
  mode: LGraphEventMode = LGraphEventMode.ALWAYS
): LGraphNode {
  const graphNode = new LGraphNode(comfyClass)
  graphNode.comfyClass = comfyClass
  graphNode.mode = mode
  for (const [name, value] of Object.entries(inputs))
    graphNode.addWidget('combo', name, value, () => {}, { values: [value] })
  return graphNode
}

let rootGraph: LGraph

function workflowHas(...nodes: LGraphNode[]) {
  for (const graphNode of nodes) rootGraph.add(graphNode)
}

function registerCheckpointLoader() {
  useNodeDefStore().updateNodeDefs([
    {
      name: 'CheckpointLoaderSimple',
      display_name: 'Load Checkpoint',
      category: 'loaders',
      python_module: 'nodes',
      description: '',
      output: ['MODEL'],
      output_node: false,
      deprecated: false,
      experimental: false,
      input: { required: { ckpt_name: ['COMBO', { options: [] }] } }
    }
  ])
}

function requestBody() {
  const [, init] = vi.mocked(fetch).mock.calls[0]
  return JSON.parse(String(init?.body))
}

function cloudAnswers(response: Response | Error) {
  if (response instanceof Error) vi.mocked(fetch).mockRejectedValue(response)
  else vi.mocked(fetch).mockResolvedValue(response)
}

describe(checkCloudCompatibility, () => {
  beforeEach(() => {
    Object.assign(useFeatureFlags().flags, {
      openOnCloudModelUploadEnabled: true
    })
    stubFirebaseAuthHarness()
    rootGraph = createTestRootGraph()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(rootGraph)
    vi.spyOn(useAuthStore(), 'getWorkspaceAuthContext').mockResolvedValue({
      headers: null
    })
  })

  it('opens a workflow when Cloud omits the optional missing models', async () => {
    workflowHas(node('KSampler'))
    cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'canOpen'
    })
  })

  it.for([
    { uploadsEnabled: true, expected: null },
    { uploadsEnabled: false, expected: { kind: 'canOpen' } }
  ])(
    'checks a workflow with models and no model verdict when uploads are $uploadsEnabled',
    async ({ uploadsEnabled, expected }) => {
      Object.assign(useFeatureFlags().flags, {
        openOnCloudModelUploadEnabled: uploadsEnabled
      })
      registerCheckpointLoader()
      workflowHas(
        node('CheckpointLoaderSimple', { ckpt_name: 'sdxl.safetensors' })
      )
      cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))

      await expect(checkCloudCompatibility()).resolves.toEqual(expected)
      expect(requestBody().models).toEqual([
        { folder: 'checkpoints', name: 'sdxl.safetensors' }
      ])
    }
  )

  it.for([
    { label: 'no credential', headers: null },
    {
      label: 'an account credential',
      headers: { Authorization: 'Bearer user' }
    }
  ] as const)(
    'keeps a signed-in workflow unchecked when workspace resolution returns $label',
    async ({ headers }) => {
      workflowHas(node('KSampler'))
      const authStore = useAuthStore()
      Object.assign(authStore, { isAuthenticated: true })
      vi.mocked(authStore.getWorkspaceAuthContext).mockResolvedValue({
        headers
      })

      await expect(checkCloudCompatibility()).resolves.toBeNull()
      expect(authStore.getWorkspaceAuthContext).toHaveBeenCalledWith({
        requireWorkspace: true
      })
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it('sends no workflow data if the workspace changes while authorization is pending', async () => {
    workflowHas(node('KSampler'))
    cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))
    const authStore = useAuthStore()
    const workspaces = useTeamWorkspaceStore()
    Object.assign(workspaces, { activeWorkspaceId: 'ws-original' })
    type AuthContext = Awaited<
      ReturnType<typeof authStore.getWorkspaceAuthContext>
    >
    let finishAuth!: (value: AuthContext) => void
    const auth = new Promise<AuthContext>((resolve) => {
      finishAuth = resolve
    })
    vi.mocked(authStore.getWorkspaceAuthContext).mockReturnValueOnce(auth)
    const checks = useCloudWorkflowCheckStore()
    const pending = checks.check()
    await vi.waitFor(() =>
      expect(authStore.getWorkspaceAuthContext).toHaveBeenCalledOnce()
    )

    Object.assign(workspaces, { activeWorkspaceId: 'ws-next' })
    finishAuth({
      headers: { Authorization: 'Bearer next-workspace' },
      workspaceId: 'ws-next'
    })
    await pending

    expect(fetch).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
    expect(checks.state.phase).toBe('idle')
  })

  it('uses account authorization for an ordinary model workflow while uploads are off', async () => {
    Object.assign(useFeatureFlags().flags, {
      openOnCloudModelUploadEnabled: false
    })
    registerCheckpointLoader()
    workflowHas(
      node('CheckpointLoaderSimple', { ckpt_name: 'sdxl.safetensors' })
    )
    const authStore = useAuthStore()
    Object.assign(authStore, { isAuthenticated: true })
    vi.spyOn(authStore, 'getAuthHeader').mockResolvedValue({
      Authorization: 'Bearer account'
    })
    cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'canOpen'
    })
    expect(authStore.getWorkspaceAuthContext).not.toHaveBeenCalled()
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer account'
    })
  })

  it('carries the workspace used by the compatibility credential into the ready verdict', async () => {
    workflowHas(node('KSampler'))
    vi.mocked(useAuthStore().getWorkspaceAuthContext).mockResolvedValue({
      headers: { Authorization: 'Bearer host-workspace' },
      workspaceId: 'ws-host'
    })
    cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'canOpen',
      workspaceId: 'ws-host'
    })
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer host-workspace'
    })
  })

  it('keeps a recovered model in the selected workspace after upload rollback', async () => {
    const model = { folder: 'checkpoints', name: 'sdxl.safetensors' }
    Object.assign(useFeatureFlags().flags, {
      openOnCloudModelUploadEnabled: false
    })
    const authStore = useAuthStore()
    Object.assign(authStore, { isAuthenticated: true })
    vi.mocked(authStore.getWorkspaceAuthContext).mockResolvedValue({
      headers: { Authorization: 'Bearer workspace' },
      workspaceId: 'ws-recovered'
    })
    registerCheckpointLoader()
    workflowHas(node('CheckpointLoaderSimple', { ckpt_name: model.name }))
    cloudAnswers(
      Response.json({ cloud: { missing_node_types: [], missing_models: [] } })
    )

    await expect(
      checkCloudCompatibility({ workspaceId: 'ws-recovered', models: [model] })
    ).resolves.toEqual({
      kind: 'canOpen',
      workspaceId: 'ws-recovered'
    })
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer workspace'
    })
  })

  it('checks a previous upload by model in the signed-in workspace', async () => {
    const model = { folder: 'loras', name: 'model.safetensors' }
    vi.mocked(useAuthStore().getWorkspaceAuthContext).mockResolvedValue({
      headers: { Authorization: 'Bearer workspace' },
      workspaceId: 'ws-upload'
    })
    cloudAnswers(
      Response.json({
        cloud: {
          missing_node_types: [],
          missing_models: [model]
        }
      })
    )

    await expect(readCloudMissingModels([model], 'ws-upload')).resolves.toEqual(
      [model]
    )
    expect(requestBody()).toEqual({ node_types: [], models: [model] })
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer workspace'
    })
  })

  it.for([
    { label: 'an explicit empty model list', missing: [], expected: [] },
    { label: 'no model verdict', missing: undefined, expected: null }
  ])(
    'reads $label when rechecking a previous upload',
    async ({ missing, expected }) => {
      vi.mocked(useAuthStore().getWorkspaceAuthContext).mockResolvedValue({
        headers: { Authorization: 'Bearer workspace' },
        workspaceId: 'ws-upload'
      })
      cloudAnswers(
        Response.json({
          cloud: { missing_node_types: [], missing_models: missing }
        })
      )

      await expect(
        readCloudMissingModels(
          [{ folder: 'loras', name: 'model.safetensors' }],
          'ws-upload'
        )
      ).resolves.toEqual(expected)
    }
  )

  it('can retry model confirmation after the workspace credential deadline', async () => {
    const model = { folder: 'loras', name: 'model.safetensors' }
    const context = {
      headers: { Authorization: 'Bearer workspace' },
      workspaceId: 'ws-upload'
    } as const
    let supplyCredentials!: (value: typeof context) => void
    const stalled = new Promise<typeof context>((resolve) => {
      supplyCredentials = resolve
    })
    const credentials = vi
      .mocked(useAuthStore().getWorkspaceAuthContext)
      .mockReturnValueOnce(stalled)
      .mockResolvedValue(context)
    const deadline = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(deadline.signal)
    cloudAnswers(
      Response.json({ cloud: { missing_node_types: [], missing_models: [] } })
    )

    const pending = readCloudMissingModels([model], 'ws-upload')
    expect(credentials).toHaveBeenCalledOnce()
    deadline.abort(new DOMException('Test deadline', 'TimeoutError'))

    await expect(pending).resolves.toBeNull()
    supplyCredentials(context)
    await stalled
    expect(fetch).not.toHaveBeenCalled()
    await expect(readCloudMissingModels([model], 'ws-upload')).resolves.toEqual(
      []
    )
    expect(fetch).toHaveBeenCalledOnce()
    expect(requestBody()).toEqual({ node_types: [], models: [model] })
  })

  it('declines to confirm storage without an explicit matching workspace', async () => {
    vi.mocked(useAuthStore().getWorkspaceAuthContext).mockResolvedValue({
      headers: { Authorization: 'Bearer account' }
    })

    await expect(
      readCloudMissingModels(
        [{ folder: 'loras', name: 'model.safetensors' }],
        'ws-upload'
      )
    ).resolves.toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('lists the node packs Cloud is missing', async () => {
    workflowHas(node('ImpactWildcard'))
    cloudAnswers(
      Response.json({ cloud: { missing_node_types: ['ImpactWildcard'] } })
    )

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'missing',
      gaps: { nodePacks: ['ImpactWildcard'], models: [] }
    })
  })

  it('asks Cloud about the node types and loader models the workflow uses', async () => {
    registerCheckpointLoader()
    workflowHas(
      node('CheckpointLoaderSimple', { ckpt_name: 'sdxl.safetensors' }),
      node('KSampler')
    )
    vi.mocked(useAuthStore().getWorkspaceAuthContext).mockResolvedValue({
      headers: { Authorization: 'Bearer token' }
    })
    cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))

    await checkCloudCompatibility()

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer token' })
    expect(JSON.parse(String(init?.body))).toEqual({
      node_types: ['CheckpointLoaderSimple', 'KSampler'],
      models: [{ folder: 'checkpoints', name: 'sdxl.safetensors' }]
    })
  })

  it('sends models from loaders the asset picker does not map, using the local model folders', async () => {
    vi.spyOn(useModelStore(), 'loadModels').mockResolvedValue([
      fromPartial<ModelFolder>({
        directory: 'text_encoders',
        models: {
          '0/t5xxl_fp16.safetensors': { file_name: 't5xxl_fp16.safetensors' },
          '0/clip_l.safetensors': { file_name: 'clip_l.safetensors' }
        }
      })
    ])
    workflowHas(
      node('DualCLIPLoader', {
        clip_name1: 't5xxl_fp16.safetensors',
        clip_name2: 'clip_l.safetensors',
        type: 'flux'
      })
    )
    cloudAnswers(
      Response.json({
        cloud: {
          missing_node_types: [],
          missing_models: [
            { folder: 'text_encoders', name: 't5xxl_fp16.safetensors' }
          ]
        }
      })
    )

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'missing',
      gaps: {
        nodePacks: [],
        models: [{ folder: 'text_encoders', name: 't5xxl_fp16.safetensors' }]
      }
    })
    expect(requestBody().models).toEqual([
      { folder: 'text_encoders', name: 't5xxl_fp16.safetensors' },
      { folder: 'text_encoders', name: 'clip_l.safetensors' }
    ])
  })

  it('asks Cloud about the rest and names the input whose model is missing from the local library', async () => {
    vi.spyOn(useModelStore(), 'loadModels').mockResolvedValue([
      fromPartial<ModelFolder>({ directory: 'text_encoders', models: {} })
    ])
    workflowHas(
      node('DualCLIPLoader', { clip_name1: 't5xxl_fp16.safetensors' })
    )
    cloudAnswers(
      Response.json({ cloud: { missing_node_types: [], missing_models: [] } })
    )

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'canOpen',
      uncheckedInputs: [{ nodeType: 'DualCLIPLoader', input: 'clip_name1' }]
    })
    expect(requestBody()).toEqual({
      node_types: ['DualCLIPLoader'],
      models: []
    })
    expect(reportError).not.toHaveBeenCalled()
  })

  it('names the input whose model file name matches more than one local folder', async () => {
    vi.spyOn(useModelStore(), 'loadModels').mockResolvedValue([
      fromPartial<ModelFolder>({
        directory: 'clip_vision',
        models: { '0/model.safetensors': { file_name: 'model.safetensors' } }
      }),
      fromPartial<ModelFolder>({
        directory: 'text_encoders',
        models: { '0/model.safetensors': { file_name: 'model.safetensors' } }
      })
    ])
    workflowHas(node('DualCLIPLoader', { clip_name1: 'model.safetensors' }))
    cloudAnswers(
      Response.json({ cloud: { missing_node_types: [], missing_models: [] } })
    )

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'canOpen',
      uncheckedInputs: [{ nodeType: 'DualCLIPLoader', input: 'clip_name1' }]
    })
  })

  it('asks Cloud about a loader whose folders share one directory, naming the models it could not place', async () => {
    const sharedDirectory = {
      '0/model.safetensors': { file_name: 'model.safetensors' },
      '0/Wan2.2_VAE.pth': { file_name: 'Wan2.2_VAE.pth' }
    }
    vi.spyOn(useModelStore(), 'loadModels').mockResolvedValue([
      fromPartial<ModelFolder>({
        directory: 'splatkit_4danyone',
        models: sharedDirectory
      }),
      fromPartial<ModelFolder>({
        directory: 'splatkit_perceptual',
        models: sharedDirectory
      }),
      fromPartial<ModelFolder>({
        directory: 'splatkit_birefnet',
        models: { '0/model.safetensors': { file_name: 'model.safetensors' } }
      }),
      fromPartial<ModelFolder>({
        directory: 'detection',
        models: {
          '0/sam_3d_body.safetensors': { file_name: 'sam_3d_body.safetensors' }
        }
      })
    ])
    workflowHas(
      node('SplatKit_4DAnyoneModelLoader', {
        checkpoint: 'model.safetensors',
        vae: 'Wan2.2_VAE.pth',
        birefnet: 'model.safetensors',
        sam3d_body: 'sam_3d_body.safetensors'
      })
    )
    cloudAnswers(
      Response.json({ cloud: { missing_node_types: [], missing_models: [] } })
    )

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'canOpen',
      uncheckedInputs: [
        { nodeType: 'SplatKit_4DAnyoneModelLoader', input: 'checkpoint' },
        { nodeType: 'SplatKit_4DAnyoneModelLoader', input: 'vae' },
        { nodeType: 'SplatKit_4DAnyoneModelLoader', input: 'birefnet' }
      ]
    })
    expect(requestBody()).toEqual({
      node_types: ['SplatKit_4DAnyoneModelLoader'],
      models: [{ folder: 'detection', name: 'sam_3d_body.safetensors' }]
    })
  })

  it('treats only picker widgets as possible model files', async () => {
    const prompt = node('CLIPTextEncode')
    prompt.addWidget('text', 'text', 'portrait.safetensors', () => {})
    workflowHas(prompt)
    cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'canOpen'
    })
    expect(requestBody().models).toEqual([])
  })

  it('reads widget values without running their serialize hooks', async () => {
    const audio = node('LoadAudio', { audio: 'take.wav' })
    const serializeValue = vi.fn()
    audio.widgets![0].serializeValue = serializeValue
    workflowHas(audio)
    cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))

    await checkCloudCompatibility()

    expect(serializeValue).not.toHaveBeenCalled()
    expect(requestBody().node_types).toEqual(['LoadAudio'])
  })

  it('asks about nodes inside subgraphs and skips bypassed, muted and virtual nodes', async () => {
    const subgraph = createTestSubgraph({ rootGraph })
    subgraph.add(node('KSampler'))
    const reroute = node('Reroute')
    reroute.isVirtualNode = true
    workflowHas(
      node('ImpactWildcard', {}, LGraphEventMode.BYPASS),
      node('ImpactSwitch', {}, LGraphEventMode.NEVER),
      reroute,
      createTestSubgraphNode(subgraph)
    )
    cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))

    await checkCloudCompatibility()

    expect(requestBody().node_types).toEqual(['KSampler'])
  })

  it('asks about node types that are not installed locally', async () => {
    const missing = new LGraphNode('ImpactWildcard')
    missing.last_serialization = fromPartial({ type: 'ImpactWildcard' })
    workflowHas(missing, node('KSampler'))
    cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))

    await checkCloudCompatibility()

    expect(requestBody().node_types).toEqual(['ImpactWildcard', 'KSampler'])
  })

  it('identifies a missing local loader that prevents the Cloud check', async () => {
    const missing = new LGraphNode('ImpactCheckpointLoader')
    missing.last_serialization = fromPartial({
      type: 'ImpactCheckpointLoader',
      widgets_values: ['sdxl.safetensors', 1]
    })
    workflowHas(missing)

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'unreadableModelLoader',
      nodeType: 'ImpactCheckpointLoader'
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.for<{ name: string; nodes: () => LGraphNode[] }>([
    { name: 'an empty canvas', nodes: () => [] },
    {
      name: 'a canvas of only notes, bypassed and muted nodes',
      nodes: () => [
        Object.assign(node('Note'), { isVirtualNode: true }),
        node('KSampler', {}, LGraphEventMode.BYPASS),
        node('SaveImage', {}, LGraphEventMode.NEVER)
      ]
    }
  ])(
    'answers $name as an empty workflow without asking Cloud',
    async ({ nodes }) => {
      workflowHas(...nodes())

      await expect(checkCloudCompatibility()).resolves.toEqual({
        kind: 'emptyWorkflow'
      })
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it('asks Cloud about the rest and names the input when a loader takes its model from another node', async () => {
    registerCheckpointLoader()
    const selector = node('ModelNameSelector')
    selector.addOutput('ckpt_name', 'COMBO')
    const loader = node('CheckpointLoaderSimple', {
      ckpt_name: 'stale.safetensors'
    })
    loader.addInput('ckpt_name', 'COMBO').widget = { name: 'ckpt_name' }
    workflowHas(selector, loader)
    selector.connect(0, loader, 0)

    cloudAnswers(
      Response.json({ cloud: { missing_node_types: [], missing_models: [] } })
    )

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'canOpen',
      uncheckedInputs: [
        { nodeType: 'CheckpointLoaderSimple', input: 'ckpt_name' }
      ]
    })
    expect(requestBody()).toEqual({
      node_types: ['ModelNameSelector', 'CheckpointLoaderSimple'],
      models: []
    })
  })

  it('reports missing Cloud nodes when the sampler choice comes from another node', async () => {
    const selector = node('ConvertStringToComboNode')
    selector.addOutput('combo', 'COMBO')
    const sampler = node('KSamplerSelect')
    sampler.addWidget('combo', 'sampler_name', 'euler', () => {}, {
      values: ['euler', 'heun']
    })
    sampler.addInput('sampler_name', 'COMBO').widget = { name: 'sampler_name' }
    workflowHas(selector, sampler)
    selector.connect(0, sampler, 0)
    cloudAnswers(
      Response.json({
        cloud: { missing_node_types: ['ConvertStringToComboNode'] }
      })
    )

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'missing',
      gaps: { nodePacks: ['ConvertStringToComboNode'], models: [] }
    })
    expect(requestBody()).toEqual({
      node_types: ['ConvertStringToComboNode', 'KSamplerSelect'],
      models: []
    })
  })

  it('names a linked filename picker with no folder mapping as unchecked', async () => {
    const selector = node('ConvertStringToComboNode')
    selector.addOutput('combo', 'COMBO')
    const loader = node('DualCLIPLoader', {
      clip_name1: 'clip_l.safetensors'
    })
    loader.addInput('clip_name1', 'COMBO').widget = { name: 'clip_name1' }
    workflowHas(selector, loader)
    selector.connect(0, loader, 0)

    cloudAnswers(
      Response.json({ cloud: { missing_node_types: [], missing_models: [] } })
    )

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'canOpen',
      uncheckedInputs: [{ nodeType: 'DualCLIPLoader', input: 'clip_name1' }]
    })
  })

  it('still reports what Cloud lacks when a linked model is also unchecked', async () => {
    registerCheckpointLoader()
    const selector = node('ModelNameSelector')
    selector.addOutput('ckpt_name', 'COMBO')
    const loader = node('CheckpointLoaderSimple', {
      ckpt_name: 'stale.safetensors'
    })
    loader.addInput('ckpt_name', 'COMBO').widget = { name: 'ckpt_name' }
    workflowHas(selector, loader)
    selector.connect(0, loader, 0)
    cloudAnswers(
      Response.json({
        cloud: { missing_node_types: ['ModelNameSelector'], missing_models: [] }
      })
    )

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'missing',
      gaps: { nodePacks: ['ModelNameSelector'], models: [] }
    })
  })

  it('still asks Cloud when only non-model inputs are connected', async () => {
    registerCheckpointLoader()
    const loader = node('CheckpointLoaderSimple', {
      ckpt_name: 'sdxl.safetensors'
    })
    loader.addOutput('MODEL', 'MODEL')
    const sampler = node('KSampler')
    sampler.addInput('model', 'MODEL')
    workflowHas(loader, sampler)
    loader.connect(0, sampler, 0)
    cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))

    await checkCloudCompatibility()

    expect(requestBody().models).toEqual([
      { folder: 'checkpoints', name: 'sdxl.safetensors' }
    ])
  })

  it('asks about the model chosen on a subgraph host, not the interior default', async () => {
    registerCheckpointLoader()
    const subgraph = createTestSubgraph({
      rootGraph,
      inputs: [{ name: 'ckpt_name', type: 'COMBO' }]
    })
    const loader = node('CheckpointLoaderSimple', {
      ckpt_name: 'interior.safetensors'
    })
    loader.addInput('ckpt_name', 'COMBO').widget = { name: 'ckpt_name' }
    subgraph.add(loader)
    subgraph.inputNode.slots[0].connect(loader.inputs[0], loader)
    const host = createTestSubgraphNode(subgraph)
    workflowHas(host)
    host.widgets[0].value = 'host.safetensors'
    cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))

    await checkCloudCompatibility()

    expect(requestBody().models).toEqual([
      { folder: 'checkpoints', name: 'host.safetensors' }
    ])
  })

  it.for([
    { name: 'a network failure', response: () => new TypeError('offline') },
    {
      name: 'a failed response',
      response: () => new Response(null, { status: 503 })
    },
    {
      name: 'a body outside the contract',
      response: () => Response.json({ cloud: { missing_node_types: 'none' } })
    }
  ])('reports $name and returns no verdict', async ({ response }) => {
    workflowHas(node('KSampler'))
    cloudAnswers(response())

    await expect(checkCloudCompatibility()).resolves.toBeNull()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.objectContaining({
        errorType: 'failure_checking_cloud_compatibility'
      })
    )
  })
})
