import { describe, expect, it } from 'vitest'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import { getExecutionStatusMessage } from './getExecutionStatusMessage'

// Pass-through t so we can assert the i18n key
const t = (key: string) => key

describe('getExecutionStatusMessage', () => {
  describe('custom messages', () => {
    it('returns custom message from properties when set', () => {
      expect(
        getExecutionStatusMessage(t, 'KSampler', null, {
          'Execution Message': 'custom status'
        })
      ).toBe('custom status')
    })

    it('ignores empty or whitespace-only custom message', () => {
      expect(
        getExecutionStatusMessage(t, 'KSampler', null, {
          'Execution Message': '  '
        })
      ).toBe('execution.generating')
    })
  })

  describe('API nodes', () => {
    it('returns processing for API nodes', () => {
      const apiDef = { api_node: true } as ComfyNodeDefImpl
      expect(getExecutionStatusMessage(t, 'SomeApiNode', apiDef)).toBe(
        'execution.processing'
      )
    })

    it('statusMap takes precedence over api_node flag', () => {
      const apiDef = { api_node: true } as ComfyNodeDefImpl
      expect(getExecutionStatusMessage(t, 'KSampler', apiDef)).toBe(
        'execution.generating'
      )
    })
  })

  describe('Node type matching', () => {
    it('does not match partial PascalCase words', () => {
      expect(getExecutionStatusMessage(t, 'Loads')).toBeNull()
    })

    it('matches identifier mid-string at PascalCase boundary', () => {
      expect(getExecutionStatusMessage(t, 'CompositeSaveImage')).toBe(
        'execution.saving'
      )
    })

    it('matches identifier followed by non-letter characters', () => {
      expect(getExecutionStatusMessage(t, 'Save_V2')).toBe('execution.saving')
      expect(getExecutionStatusMessage(t, 'LoadImage🐍')).toBe(
        'execution.loading'
      )
    })

    const testNodeTypes: [string, string[]][] = [
      ['generating', ['KSampler', 'SamplerCustomAdvanced']],
      [
        'saving',
        ['SaveImage', 'SaveAnimatedWEBP', 'PreviewImage', 'MaskPreview']
      ],
      ['loading', ['LoadImage', 'VAELoader', 'CheckpointLoaderSimple']],
      [
        'encoding',
        ['VAEEncode', 'StableCascade_StageC_VAEEncode', 'CLIPTextEncode']
      ],
      ['decoding', ['VAEDecode', 'VAEDecodeHunyuan3D']],
      [
        'resizing',
        ['ImageUpscaleWithModel', 'LatentUpscale', 'ResizeImageMaskNode']
      ],
      [
        'processing',
        ['TorchCompileModel', 'SVD_img2vid_Conditioning', 'ModelMergeSimple']
      ],
      ['generatingVideo', ['WanImageToVideo', 'WanFunControlToVideo']],
      ['processingVideo', ['Video Slice', 'CreateVideo']],
      ['training', ['TrainLoraNode']]
    ]

    it.for(
      testNodeTypes.flatMap(([status, nodes]) =>
        nodes.map((node) => [status, node] as const)
      )
    )('%s ← %s', ([status, nodeType]) => {
      expect(getExecutionStatusMessage(t, nodeType)).toBe(`execution.${status}`)
    })
  })

  it('returns null for nodes matching no pattern', () => {
    expect(getExecutionStatusMessage(t, 'PrimitiveString')).toBeNull()
  })
})
