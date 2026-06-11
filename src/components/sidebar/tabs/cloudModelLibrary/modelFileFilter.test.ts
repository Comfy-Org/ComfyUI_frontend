import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import { isLikelyModelFile } from './modelFileFilter'

function makeAsset(name: string, filename?: string): AssetItem {
  return {
    id: 'a1',
    name,
    tags: ['models'],
    ...(filename ? { metadata: { filename } } : {})
  }
}

describe('isLikelyModelFile', () => {
  it('keeps recognised model formats', () => {
    expect(isLikelyModelFile(makeAsset('sd_xl_base_1.0.safetensors'))).toBe(
      true
    )
    expect(isLikelyModelFile(makeAsset('mm_sdxl_v10_beta.ckpt'))).toBe(true)
    expect(isLikelyModelFile(makeAsset('yolov10m.onnx'))).toBe(true)
    expect(isLikelyModelFile(makeAsset('llama-3.2.Q4_K_M.gguf'))).toBe(true)
    expect(isLikelyModelFile(makeAsset('pytorch_model.bin'))).toBe(true)
  })

  it('drops sidecar files that live next to models on disk', () => {
    expect(isLikelyModelFile(makeAsset('v1-inference.yaml'))).toBe(false)
    expect(isLikelyModelFile(makeAsset('tokenizer_config.json'))).toBe(false)
    expect(isLikelyModelFile(makeAsset('modeling_florence2.py'))).toBe(false)
    expect(isLikelyModelFile(makeAsset('FreeMono.ttf'))).toBe(false)
    expect(isLikelyModelFile(makeAsset('intrinsic_loras.txt'))).toBe(false)
  })

  it('drops junk basenames regardless of extension', () => {
    expect(isLikelyModelFile(makeAsset('LICENSE'))).toBe(false)
    expect(isLikelyModelFile(makeAsset('README.md'))).toBe(false)
  })

  it('keeps display names without a parseable extension', () => {
    expect(isLikelyModelFile(makeAsset('Flux.1 [dev]'))).toBe(true)
    expect(isLikelyModelFile(makeAsset('Stable Diffusion XL'))).toBe(true)
  })

  it('prefers the real filename from metadata over the display name', () => {
    expect(
      isLikelyModelFile(makeAsset('Florence 2 processing', 'processing.py'))
    ).toBe(false)
    expect(
      isLikelyModelFile(makeAsset('SDXL Base', 'sd_xl_base_1.0.safetensors'))
    ).toBe(true)
  })
})
