import { describe, expect, it } from 'vitest'

import {
  getBadgeLabel,
  hasValidDirectory,
  isModelDownloadable
} from '@/components/dialog/content/missingModelsUtils'
import type { ModelWithUrl } from '@/components/dialog/content/missingModelsUtils'

function makeModel(overrides: Partial<ModelWithUrl> = {}): ModelWithUrl {
  return {
    name: 'model.safetensors',
    url: 'https://civitai.com/api/download/12345',
    directory: 'checkpoints',
    ...overrides
  }
}

describe('isModelDownloadable', () => {
  it('allows civitai URLs with valid suffix', () => {
    expect(isModelDownloadable(makeModel())).toBe(true)
  })

  it('allows huggingface URLs with valid suffix', () => {
    expect(
      isModelDownloadable(
        makeModel({
          url: 'https://huggingface.co/some/model',
          name: 'model.ckpt'
        })
      )
    ).toBe(true)
  })

  it('allows localhost URLs with valid suffix', () => {
    expect(
      isModelDownloadable(makeModel({ url: 'http://localhost:8080/model' }))
    ).toBe(true)
  })

  it('rejects URLs from unknown sources', () => {
    expect(
      isModelDownloadable(
        makeModel({ url: 'https://evil.com/model.safetensors' })
      )
    ).toBe(false)
  })

  it('rejects files with invalid suffix', () => {
    expect(isModelDownloadable(makeModel({ name: 'model.exe' }))).toBe(false)
  })

  it('allows whitelisted URLs regardless of suffix', () => {
    expect(
      isModelDownloadable(
        makeModel({
          url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth',
          name: 'RealESRGAN_x4plus.pth'
        })
      )
    ).toBe(true)
  })
})

describe('hasValidDirectory', () => {
  it('returns true when directory exists in paths', () => {
    const paths = { checkpoints: ['/models/checkpoints'] }
    expect(hasValidDirectory(makeModel(), paths)).toBe(true)
  })

  it('returns false when directory is missing', () => {
    expect(hasValidDirectory(makeModel(), {})).toBe(false)
  })
})

describe('getBadgeLabel', () => {
  it('maps known directories to badge labels', () => {
    expect(getBadgeLabel('vae')).toBe('VAE')
    expect(getBadgeLabel('loras')).toBe('LORA')
    expect(getBadgeLabel('checkpoints')).toBe('CHECKPOINT')
  })

  it('uppercases unknown directories', () => {
    expect(getBadgeLabel('custom_dir')).toBe('CUSTOM_DIR')
  })
})
