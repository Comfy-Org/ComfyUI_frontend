import { describe, expect, it } from 'vitest'

import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { deploymentBuildBrief } from '@/platform/workspace/deploymentBuildBrief'

const deployment: WorkspaceDeployment = {
  deployment_id: 'dep-1',
  deployment_name: 'production',
  build_id: 'build-7',
  build_name: 'video-minimax-h3 copy',
  release_id: 'rel-3',
  status: 'ready',
  created_at: '2026-10-01T00:00:00Z'
}

describe(deploymentBuildBrief, () => {
  it('names the deployment, its Build and release, and lists what it lacks', () => {
    const brief = deploymentBuildBrief(
      deployment,
      [
        {
          packId: null,
          nodeTypes: ['QwenImage21Cache', 'TextEncodeQwenImage21']
        },
        { packId: 'comfyui-kjnodes', nodeTypes: ['ImageResizeKJ'] }
      ],
      [
        {
          name: 'qwen_image_2.1_vae.safetensors',
          directory: 'vae',
          url: 'https://huggingface.co/comfy/qwen/resolve/main/vae.safetensors'
        },
        { name: 'mystery.safetensors', directory: null }
      ]
    )

    expect(brief).toContain('**production**\n(`dep-1`)')
    expect(brief).toContain(
      'release `rel-3` of\nthe Build **video-minimax-h3 copy** (`build-7`)'
    )
    expect(brief).toContain(
      '- Pack unknown: `QwenImage21Cache`, `TextEncodeQwenImage21`'
    )
    expect(brief).toContain('- Pack `comfyui-kjnodes`: `ImageResizeKJ`')
    expect(brief).toContain(
      '- `qwen_image_2.1_vae.safetensors` in `models/vae`, from https://huggingface.co/comfy/qwen/resolve/main/vae.safetensors'
    )
    expect(brief).toContain('- `mystery.safetensors`\n')
    expect(brief).toContain('comfy skills show comfy-build')
    expect(brief).toContain('you deploy it to **production**.')
  })

  it.for([
    { lacks: 'only models', packs: [], section: '## Custom nodes' },
    {
      lacks: 'only custom nodes',
      packs: [{ packId: null, nodeTypes: ['A'] }],
      section: '## Models'
    }
  ])(
    'leaves out an empty list when the deployment lacks $lacks',
    ({ packs, section }) => {
      const models =
        packs.length === 0 ? [{ name: 'm.safetensors', directory: 'vae' }] : []

      expect(deploymentBuildBrief(deployment, packs, models)).not.toContain(
        section
      )
    }
  )

  it('falls back to the deployment id and an unnamed Build when the listing has no names', () => {
    const brief = deploymentBuildBrief(
      {
        deployment_id: 'dep-1',
        release_id: 'rel-3',
        status: 'ready',
        created_at: '2026-10-01T00:00:00Z'
      },
      [],
      [{ name: 'm.safetensors', directory: 'vae' }]
    )

    expect(brief).toContain('**dep-1**')
    expect(brief).toContain('release `rel-3` of\nits Build on')
  })
})
