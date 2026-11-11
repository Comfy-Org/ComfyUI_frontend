import { describe, expect, it } from 'vitest'

import { findModelReplacements } from '@/platform/workflowErrors/missingModel/modelReplacements'

describe('findModelReplacements', () => {
  it.for([
    {
      case: 'the same file in a Windows subfolder',
      missing: 'minimax_h3_image_pruned_int8_convrot.safetensors',
      options: [
        'MiniMax.H3.Image\\minimax_h3_image_pruned_int8_convrot.safetensors',
        'minimax_h3_image_vae_fp16.safetensors'
      ],
      expected: [
        'MiniMax.H3.Image\\minimax_h3_image_pruned_int8_convrot.safetensors'
      ]
    },
    {
      case: 'the same file at the root when the workflow names a subfolder',
      missing: 'flux/flux1-dev.safetensors',
      options: ['flux1-dev.safetensors', 'flux1-schnell.safetensors'],
      expected: ['flux1-dev.safetensors']
    },
    {
      case: 'the same model at a different quantization method',
      missing: 'qwen3.5_9b_w4a8_gptq.safetensors',
      options: [
        'MOSS\\qwen3.5_9b_int8_convrot.safetensors',
        'MOSS\\qwen3.5_4b_int8_convrot.safetensors',
        'qwen3vl_32b_minimax_h3_int8_convrot.safetensors'
      ],
      expected: ['MOSS\\qwen3.5_9b_int8_convrot.safetensors']
    },
    {
      case: 'float precision and fp8 layout variants',
      missing: 'flux1-dev-fp8-e4m3fn.safetensors',
      options: [
        'flux1-dev-bf16.safetensors',
        'flux1-dev.safetensors',
        'flux1-schnell-fp8-e4m3fn.safetensors'
      ],
      expected: ['flux1-dev-bf16.safetensors', 'flux1-dev.safetensors']
    },
    {
      case: 'GGUF quant levels',
      missing: 'wan2.1-t2v-14b-Q4_K_M.gguf',
      options: [
        'wan2.1-t2v-14b-Q8_0.gguf',
        'wan2.1-t2v-1.3b-Q8_0.gguf',
        'wan2.1-t2v-14b-q5-k-s.gguf'
      ],
      expected: ['wan2.1-t2v-14b-Q8_0.gguf', 'wan2.1-t2v-14b-q5-k-s.gguf']
    },
    {
      case: 'the same file in a subfolder ahead of a quantization variant',
      missing: 'model_fp16.safetensors',
      options: ['model_bf16.safetensors', 'sub/model_fp16.safetensors'],
      expected: ['sub/model_fp16.safetensors', 'model_bf16.safetensors']
    },
    {
      case: 'mixed-precision and bit-width variants',
      missing: 'flux2_dev_fp8mixed.safetensors',
      options: [
        'flux2_dev_bf16.safetensors',
        'flux2_klein_fp8mixed.safetensors'
      ],
      expected: ['flux2_dev_bf16.safetensors']
    },
    {
      case: 'nothing from a different model folder sharing a generic file name',
      missing: 'controlnet-canny-sdxl/diffusion_pytorch_model.fp16.safetensors',
      options: [
        'controlnet-depth-sdxl\\diffusion_pytorch_model.fp16.safetensors',
        'controlnet-depth-sdxl/diffusion_pytorch_model.safetensors'
      ],
      expected: []
    },
    {
      case: 'nothing from a different parent path ending in the same folder',
      missing: 'sdxl/canny/model.safetensors',
      options: ['sd15/canny/model.safetensors'],
      expected: []
    },
    {
      case: 'nothing for a name whose own words read like quantization',
      missing: 'mixed_style_lora.safetensors',
      options: [
        'style_lora.safetensors',
        'detail_tweaker.safetensors',
        'detail_tweaker_quant.safetensors'
      ],
      expected: []
    },
    {
      case: 'nothing across file extensions',
      missing: 'sd3_fp16.safetensors',
      options: ['sd3.5_large', 'sd3_fp16.safetensors.bak'],
      expected: []
    },
    {
      case: 'nothing for a name that is only a quantization tag',
      missing: 'fp16.safetensors',
      options: ['bf16.safetensors'],
      expected: []
    },
    {
      case: 'at most three suggestions',
      missing: 'model_fp16.safetensors',
      options: [
        'model_bf16.safetensors',
        'model_fp32.safetensors',
        'model_fp8_scaled.safetensors',
        'model_int8.safetensors'
      ],
      expected: [
        'model_bf16.safetensors',
        'model_fp32.safetensors',
        'model_fp8_scaled.safetensors'
      ]
    }
  ])('suggests $case', ({ missing, options, expected }) => {
    expect(findModelReplacements(missing, options)).toEqual(expected)
  })

  it('reflects options added to the same list after an earlier lookup', () => {
    const options = ['other.safetensors']
    findModelReplacements('m_fp16.safetensors', options)
    options.push('m_bf16.safetensors')

    expect(findModelReplacements('m_fp16.safetensors', options)).toEqual([
      'm_bf16.safetensors'
    ])
  })
})
