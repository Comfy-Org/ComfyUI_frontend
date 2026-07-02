import { describe, expect, it } from 'vitest'

import {
  buildModelId,
  filenameFromUrl,
  hasModelExtension,
  hostFromUrl,
  isLikelyAllowedHost,
  isValidPathSegment
} from './modelId'

describe('modelId utils', () => {
  describe('isValidPathSegment', () => {
    it('accepts valid filenames', () => {
      expect(isValidPathSegment('my_lora.safetensors')).toBe(true)
      expect(isValidPathSegment('sdxl-base.ckpt')).toBe(true)
    })

    it('rejects traversal, leading dots, and slashes', () => {
      expect(isValidPathSegment('..')).toBe(false)
      expect(isValidPathSegment('.hidden')).toBe(false)
      expect(isValidPathSegment('nested/path')).toBe(false)
      expect(isValidPathSegment('')).toBe(false)
    })
  })

  describe('hasModelExtension', () => {
    it('matches known extensions case-insensitively', () => {
      expect(hasModelExtension('model.SAFETENSORS')).toBe(true)
      expect(hasModelExtension('weights.gguf')).toBe(true)
    })

    it('rejects unknown extensions', () => {
      expect(hasModelExtension('readme.txt')).toBe(false)
      expect(hasModelExtension('archive.zip')).toBe(false)
    })
  })

  describe('buildModelId', () => {
    it('joins directory and filename with a single slash', () => {
      expect(buildModelId('loras', 'x.safetensors')).toBe('loras/x.safetensors')
    })

    it('collapses redundant slashes at the join boundary', () => {
      expect(buildModelId('loras/', 'x.safetensors')).toBe(
        'loras/x.safetensors'
      )
      expect(buildModelId('loras', '/x.safetensors')).toBe(
        'loras/x.safetensors'
      )
      expect(buildModelId('loras//', '//x.safetensors')).toBe(
        'loras/x.safetensors'
      )
    })
  })

  describe('hostFromUrl', () => {
    it('extracts the lowercased host', () => {
      expect(hostFromUrl('https://HuggingFace.co/a/b')).toBe('huggingface.co')
    })

    it('returns null for invalid URLs', () => {
      expect(hostFromUrl('not a url')).toBeNull()
    })
  })

  describe('isLikelyAllowedHost', () => {
    it('allows built-in hosts and their subdomains', () => {
      expect(isLikelyAllowedHost('https://huggingface.co/x')).toBe(true)
      expect(isLikelyAllowedHost('https://cdn.huggingface.co/x')).toBe(true)
      expect(isLikelyAllowedHost('https://civitai.com/api/download/1')).toBe(
        true
      )
    })

    it('flags unknown hosts', () => {
      expect(isLikelyAllowedHost('https://example.com/x')).toBe(false)
      expect(isLikelyAllowedHost('garbage')).toBe(false)
    })

    it('does not treat a fake subdomain of an allowed IP literal as allowed', () => {
      expect(isLikelyAllowedHost('https://127.0.0.1/x')).toBe(true)
      expect(isLikelyAllowedHost('https://evil.127.0.0.1/x')).toBe(false)
    })
  })

  describe('filenameFromUrl', () => {
    it('returns the decoded trailing path segment', () => {
      expect(filenameFromUrl('https://h.co/a/my%20model.safetensors')).toBe(
        'my model.safetensors'
      )
    })

    it('returns empty string when no segment is present', () => {
      expect(filenameFromUrl('https://h.co/')).toBe('')
      expect(filenameFromUrl('bad')).toBe('')
    })
  })
})
