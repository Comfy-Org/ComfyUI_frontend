import { describe, expect, it } from 'vitest'

import { formatCategoryLabel } from '@/platform/assets/utils/categoryLabel'

describe('formatCategoryLabel', () => {
  it('returns "Models" for undefined input', () => {
    expect(formatCategoryLabel(undefined)).toBe('Models')
  })

  it('returns "Models" for empty string', () => {
    expect(formatCategoryLabel('')).toBe('Models')
  })

  it('returns "Diffusion" for the special case "diffusion_models"', () => {
    expect(formatCategoryLabel('diffusion_models')).toBe('Diffusion')
  })

  it('capitalizes regular words joined by underscores', () => {
    expect(formatCategoryLabel('text_encoder')).toBe('Text Encoder')
  })

  it('preserves the VAE acronym', () => {
    expect(formatCategoryLabel('vae')).toBe('VAE')
  })

  it('preserves the CLIP acronym', () => {
    expect(formatCategoryLabel('clip')).toBe('CLIP')
  })

  it('preserves the GLIGEN acronym', () => {
    expect(formatCategoryLabel('gligen')).toBe('GLIGEN')
  })

  it('handles mixed acronym and regular word', () => {
    expect(formatCategoryLabel('clip_vision')).toBe('CLIP Vision')
  })

  it('capitalizes a single word', () => {
    expect(formatCategoryLabel('checkpoints')).toBe('Checkpoints')
  })
})
