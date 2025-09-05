import { describe, expect, it } from 'vitest'

import {
  generateAllStandardPaths,
  getDirectoryConfig,
  getLegacyDirectoryOrder,
  hasSubfolders,
  mergeWithAssetDirectories
} from '@/utils/modelPaths'

describe('modelPaths', () => {
  describe('getLegacyDirectoryOrder', () => {
    it('returns exact legacy API order', () => {
      const result = getLegacyDirectoryOrder()

      expect(result).toEqual([
        'checkpoints',
        'clip',
        'clip_vision',
        'configs',
        'controlnet',
        'diffusion_models',
        'embeddings',
        'gligen',
        'hypernetworks',
        'loras',
        'style_models',
        'unet',
        'upscale_models',
        'vae'
      ])
    })
  })

  describe('getDirectoryConfig', () => {
    it('returns config for known directory', () => {
      const result = getDirectoryConfig('checkpoints')

      expect(result).toEqual({
        order: 0,
        aliases: ['checkpoints', 'Stable-diffusion'],
        subfolders: []
      })
    })

    it('returns config for hierarchical directory', () => {
      const result = getDirectoryConfig('controlnet')

      expect(result?.subfolders).toEqual([
        'preprocessors',
        'diffusers_xl',
        'diffusers'
      ])
    })

    it('returns undefined for unknown directory', () => {
      const result = getDirectoryConfig('nonexistent')

      expect(result).toBeUndefined()
    })
  })

  describe('hasSubfolders', () => {
    it('returns true for hierarchical directories', () => {
      expect(hasSubfolders('controlnet')).toBe(true)
      expect(hasSubfolders('loras')).toBe(true)
      expect(hasSubfolders('upscale_models')).toBe(true)
    })

    it('returns false for flat directories', () => {
      expect(hasSubfolders('checkpoints')).toBe(false)
      expect(hasSubfolders('clip')).toBe(false)
    })
  })

  describe('generateAllStandardPaths', () => {
    it('generates paths in legacy order', () => {
      const result = generateAllStandardPaths()

      const directories = Object.keys(result)
      expect(directories).toEqual(getLegacyDirectoryOrder())
    })

    it('includes main and alias paths', () => {
      const result = generateAllStandardPaths(['/test'])

      expect(result.checkpoints).toContain('/test/checkpoints')
      expect(result.checkpoints).toContain('/test/Stable-diffusion')
    })

    it('includes subfolder paths for hierarchical directories', () => {
      const result = generateAllStandardPaths(['/test'])

      expect(result.controlnet).toContain('/test/controlnet')
      expect(result.controlnet).toContain('/test/controlnet/preprocessors')
      expect(result.controlnet).toContain('/test/controlnet/diffusers_xl')
    })

    it('preserves Windows path separators', () => {
      const result = generateAllStandardPaths(['C:\\test'])

      expect(result.checkpoints).toContain('C:\\test\\checkpoints')
      expect(result.controlnet).toContain('C:\\test\\controlnet\\preprocessors')
    })
  })

  describe('mergeWithAssetDirectories', () => {
    it('preserves legacy order for known directories', () => {
      const result = mergeWithAssetDirectories(['vae', 'checkpoints', 'clip'])

      const directories = Object.keys(result)
      expect(directories).toEqual(['checkpoints', 'clip', 'vae'])
    })

    it('appends unknown directories at end', () => {
      const result = mergeWithAssetDirectories([
        'checkpoints',
        'unknown',
        'vae'
      ])

      const directories = Object.keys(result)
      expect(directories).toEqual(['checkpoints', 'vae', 'unknown'])
    })

    it('generates paths for unknown directories', () => {
      const result = mergeWithAssetDirectories(['unknown'], ['/test'])

      expect(result.unknown).toContain('/test/unknown')
    })

    it('returns empty object for empty input', () => {
      const result = mergeWithAssetDirectories([])

      expect(result).toEqual({})
    })

    it('only includes present directories', () => {
      const result = mergeWithAssetDirectories(['checkpoints'])

      expect(Object.keys(result)).toEqual(['checkpoints'])
    })
  })
})
