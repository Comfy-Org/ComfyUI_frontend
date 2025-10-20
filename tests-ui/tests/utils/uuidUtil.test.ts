import { describe, expect, it } from 'vitest'

import {
  extractPromptIdFromAssetId,
  extractUuidFromString,
  isValidUuid
} from '@/utils/uuidUtil'

describe('uuidUtil', () => {
  describe('extractUuidFromString', () => {
    it('should extract UUID from the beginning of a string', () => {
      const str = '98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3-9-ComfyUI_00042_.png'
      const result = extractUuidFromString(str)
      expect(result).toBe('98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3')
    })

    it('should extract UUID with uppercase letters', () => {
      const str = 'A8B0B007-7D78-4E3F-B7A8-0F483B9CF2D3-node-file.png'
      const result = extractUuidFromString(str)
      expect(result).toBe('A8B0B007-7D78-4E3F-B7A8-0F483B9CF2D3')
    })

    it('should return null if no UUID at the beginning', () => {
      const str = 'not-a-uuid-98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3'
      const result = extractUuidFromString(str)
      expect(result).toBeNull()
    })

    it('should return null for invalid UUID format', () => {
      const str = '12345678-1234-1234-1234-123456789abc-extra'
      const result = extractUuidFromString(str)
      expect(result).toBe('12345678-1234-1234-1234-123456789abc')
    })

    it('should handle UUID without trailing content', () => {
      const str = '98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3'
      const result = extractUuidFromString(str)
      expect(result).toBe('98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3')
    })

    it('should return null for empty string', () => {
      const result = extractUuidFromString('')
      expect(result).toBeNull()
    })

    it('should return null for malformed UUID', () => {
      const str = '98b0b007-7d78-4e3f-b7a8'
      const result = extractUuidFromString(str)
      expect(result).toBeNull()
    })
  })

  describe('isValidUuid', () => {
    it('should return true for valid UUID v4', () => {
      const uuid = '98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3'
      expect(isValidUuid(uuid)).toBe(true)
    })

    it('should return true for uppercase UUID', () => {
      const uuid = 'A8B0B007-7D78-4E3F-B7A8-0F483B9CF2D3'
      expect(isValidUuid(uuid)).toBe(true)
    })

    it('should return true for mixed case UUID', () => {
      const uuid = 'a8B0b007-7D78-4e3F-B7a8-0F483b9CF2d3'
      expect(isValidUuid(uuid)).toBe(true)
    })

    it('should return false for UUID with extra characters', () => {
      const uuid = '98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3-extra'
      expect(isValidUuid(uuid)).toBe(false)
    })

    it('should return false for incomplete UUID', () => {
      const uuid = '98b0b007-7d78-4e3f-b7a8'
      expect(isValidUuid(uuid)).toBe(false)
    })

    it('should return false for UUID with wrong segment lengths', () => {
      const uuid = '98b0b0007-7d78-4e3f-b7a8-0f483b9cf2d3'
      expect(isValidUuid(uuid)).toBe(false)
    })

    it('should return false for UUID with invalid characters', () => {
      const uuid = '98b0b007-7d78-4e3f-b7a8-0f483b9cfzd3'
      expect(isValidUuid(uuid)).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isValidUuid('')).toBe(false)
    })

    it('should return false for null-like values', () => {
      expect(isValidUuid('null')).toBe(false)
      expect(isValidUuid('undefined')).toBe(false)
    })
  })

  describe('extractPromptIdFromAssetId', () => {
    it('should extract promptId from typical asset ID', () => {
      const assetId =
        '98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3-9-ComfyUI_00042_.png'
      const result = extractPromptIdFromAssetId(assetId)
      expect(result).toBe('98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3')
    })

    it('should extract promptId with multiple dashes in filename', () => {
      const assetId =
        '98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3-15-my-image-file.png'
      const result = extractPromptIdFromAssetId(assetId)
      expect(result).toBe('98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3')
    })

    it('should handle asset ID with just UUID and node ID', () => {
      const assetId = '98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3-42'
      const result = extractPromptIdFromAssetId(assetId)
      expect(result).toBe('98b0b007-7d78-4e3f-b7a8-0f483b9cf2d3')
    })

    it('should return null for input folder asset ID', () => {
      const assetId = 'input-0-myimage.png'
      const result = extractPromptIdFromAssetId(assetId)
      expect(result).toBeNull()
    })

    it('should return null for malformed asset ID', () => {
      const assetId = 'not-a-valid-asset-id'
      const result = extractPromptIdFromAssetId(assetId)
      expect(result).toBeNull()
    })

    it('should handle asset ID with special characters in filename', () => {
      const assetId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890-1-image(1)[2].png'
      const result = extractPromptIdFromAssetId(assetId)
      expect(result).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    })

    it('should return null for empty string', () => {
      const result = extractPromptIdFromAssetId('')
      expect(result).toBeNull()
    })

    it('should handle asset ID with underscores in UUID position', () => {
      const assetId = 'output_1_image.png'
      const result = extractPromptIdFromAssetId(assetId)
      expect(result).toBeNull()
    })
  })
})
