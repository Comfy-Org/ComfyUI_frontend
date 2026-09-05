// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import {
  getWhatIsDescription,
  getPageDescription,
  getFaqPricingAnswer
} from './modelSeoCopy'
import type { Model } from '../config/models'

describe('modelSeoCopy', () => {
  const localModel: Model = {
    slug: 'local-model',
    name: 'local_model',
    displayName: 'Local Model',
    directory: 'diffusion_models',
    huggingFaceUrl: 'https://huggingface.co/local',
    featured: false,
    workflowCount: 10
  }

  const partnerWithHF: Model = {
    slug: 'partner-hf',
    name: 'partner_hf',
    displayName: 'Partner HF',
    directory: 'partner_nodes',
    huggingFaceUrl: 'https://huggingface.co/partner',
    featured: false,
    workflowCount: 5
  }

  const partnerCloudOnly: Model = {
    slug: 'partner-cloud',
    name: 'partner_cloud',
    displayName: 'Partner Cloud',
    directory: 'partner_nodes',
    huggingFaceUrl: '',
    featured: false,
    workflowCount: 42
  }

  const standardCloudApi: Model = {
    slug: 'standard-api',
    name: 'standard_api',
    displayName: 'Standard API',
    directory: 'diffusion_models',
    huggingFaceUrl: '',
    featured: false,
    workflowCount: 15
  }

  describe('getWhatIsDescription', () => {
    it('returns local inference copy for standard models', () => {
      const desc = getWhatIsDescription(localModel, 'a diffusion model')
      expect(desc).toContain('run it locally in ComfyUI with full control')
    })

    it('returns local inference copy for partner models with HF URLs', () => {
      const desc = getWhatIsDescription(partnerWithHF, 'a partner model')
      expect(desc).toContain('run it locally in ComfyUI with full control')
    })

    it('returns cloud-only copy for partner models without HF URLs', () => {
      const desc = getWhatIsDescription(partnerCloudOnly, 'a cloud model')
      expect(desc).not.toContain('run it locally')
      expect(desc).toContain('access it through Comfy Cloud')
    })
  })

  describe('getPageDescription', () => {
    it('returns local inference copy for standard models', () => {
      const desc = getPageDescription(localModel)
      expect(desc).toContain('full parameter control')
      expect(desc).toContain('free local inference')
    })

    it('returns cloud-only copy for partner models without HF URLs', () => {
      const desc = getPageDescription(partnerCloudOnly)
      expect(desc).not.toContain('full parameter control')
      expect(desc).not.toContain('free local inference')
    })
  })

  describe('getFaqPricingAnswer', () => {
    it('returns standard open source copy for local models', () => {
      const ans = getFaqPricingAnswer(localModel)
      expect(ans).toContain('ComfyUI is free and open source')
      expect(ans).toContain('weights are available to download')
      expect(ans).toContain(
        'local inference on your own hardware is always free'
      )
    })

    it('returns API copy for partner models with HF URLs', () => {
      const ans = getFaqPricingAnswer(partnerWithHF)
      expect(ans).toContain('ComfyUI is free and open source')
      expect(ans).toContain('weights are available to download')
    })

    it('returns cloud-only copy for partner models without HF URLs', () => {
      const ans = getFaqPricingAnswer(partnerCloudOnly)
      expect(ans).toContain('exclusively on Comfy Cloud')
      expect(ans).toContain('Pay-per-compute pricing applies')
      expect(ans).not.toContain('local inference')
    })

    it('returns cloud-only copy for standard models without HF URLs', () => {
      const ans = getFaqPricingAnswer(standardCloudApi)
      expect(ans).toContain('exclusively on Comfy Cloud')
      expect(ans).not.toContain('local inference')
    })
  })
})
