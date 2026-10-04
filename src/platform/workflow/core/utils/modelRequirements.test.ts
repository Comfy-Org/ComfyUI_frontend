import { describe, expect, it } from 'vitest'

import { getSelectedModelsMetadata } from './modelRequirements'

describe('modelRequirements', () => {
  describe('filterModelsByCurrentSelection', () => {
    it('should filter models to only include those selected in widget values', () => {
      const node = {
        type: 'CheckpointLoaderSimple',
        widgets_values: ['model_a.safetensors'],
        properties: {
          models: [
            {
              name: 'model_a.safetensors',
              url: 'https://example.com/model_a.safetensors',
              directory: 'checkpoints'
            },
            {
              name: 'model_b.safetensors',
              url: 'https://example.com/model_b.safetensors',
              directory: 'checkpoints'
            }
          ]
        }
      }

      const result = getSelectedModelsMetadata(node)

      expect(result).toHaveLength(1)
      expect(result![0].name).toBe('model_a.safetensors')
    })

    it('should return empty array when no models match selection', () => {
      const node = {
        type: 'SomeNode',
        widgets_values: ['unmatched_model.safetensors'],
        properties: {
          models: [
            {
              name: 'model_a.safetensors',
              url: 'https://example.com/model_a.safetensors',
              directory: 'checkpoints'
            }
          ]
        }
      }

      const result = getSelectedModelsMetadata(node)

      expect(result).toHaveLength(0)
    })

    it('should handle multiple widget values', () => {
      const node = {
        type: 'SomeNode',
        widgets_values: ['model_a.safetensors', 42, 'model_c.ckpt'],
        properties: {
          models: [
            {
              name: 'model_a.safetensors',
              url: 'https://example.com/model_a.safetensors',
              directory: 'checkpoints'
            },
            {
              name: 'model_b.safetensors',
              url: 'https://example.com/model_b.safetensors',
              directory: 'checkpoints'
            },
            {
              name: 'model_c.ckpt',
              url: 'https://example.com/model_c.ckpt',
              directory: 'checkpoints'
            }
          ]
        }
      }

      const result = getSelectedModelsMetadata(node)

      expect(result).toHaveLength(2)
      expect(result!.map((m) => m.name)).toEqual([
        'model_a.safetensors',
        'model_c.ckpt'
      ])
    })

    it('should ignore non-string widget values', () => {
      const node = {
        type: 'SomeNode',
        widgets_values: [42, true, null, undefined, 'model_a.safetensors'],
        properties: {
          models: [
            {
              name: 'model_a.safetensors',
              url: 'https://example.com/model_a.safetensors',
              directory: 'checkpoints'
            }
          ]
        }
      }

      const result = getSelectedModelsMetadata(node)

      expect(result).toHaveLength(1)
      expect(result![0].name).toBe('model_a.safetensors')
    })

    it.for([
      { name: 'not an array', models: 'model_a.safetensors' },
      { name: 'an array of null', models: [null] },
      { name: 'an array of non-records', models: [1, 'x', true] },
      {
        name: 'an array of records missing a name',
        models: [{ url: 'https://example.com/a.safetensors' }]
      }
    ])('returns nothing when properties.models is $name', ({ models }) => {
      const node = {
        type: 'SomeNode',
        widgets_values: ['model_a.safetensors'],
        properties: { models }
      }

      expect(() => getSelectedModelsMetadata(node)).not.toThrow()
      expect(getSelectedModelsMetadata(node)).toBeUndefined()
    })

    it('keeps every named entry and discards the rest', () => {
      const node = {
        type: 'SomeNode',
        widgets_values: ['model_a.safetensors', 'model_b.safetensors'],
        properties: {
          models: [
            null,
            {
              name: 'model_a.safetensors',
              url: 'https://example.com/model_a.safetensors',
              directory: 'checkpoints'
            },
            { name: 'model_b.safetensors' }
          ]
        }
      }

      // A partial entry is the whole point of this path: workflows that
      // failed strict validation still load, and enrichment fills each field
      // where present. Requiring the strict shape here discarded the
      // directory and hash those entries do carry.
      expect(getSelectedModelsMetadata(node)).toEqual([
        {
          name: 'model_a.safetensors',
          url: 'https://example.com/model_a.safetensors',
          directory: 'checkpoints'
        },
        { name: 'model_b.safetensors' }
      ])
    })

    it.for([
      {
        name: 'a directory but no url',
        model: { name: 'model_a.safetensors', directory: 'loras' }
      },
      {
        name: 'a hash but no url',
        model: {
          name: 'model_a.safetensors',
          directory: 'loras',
          hash: 'abc',
          hash_type: 'sha256'
        }
      },
      {
        name: 'a relative url',
        model: {
          name: 'model_a.safetensors',
          directory: 'loras',
          url: '/models/loras/model_a.safetensors'
        }
      }
    ])('keeps an entry carrying $name', ({ model }) => {
      expect(
        getSelectedModelsMetadata({
          type: 'SomeNode',
          widgets_values: ['model_a.safetensors'],
          properties: { models: [model] }
        })
      ).toEqual([model])
    })

    it('should ignore empty strings', () => {
      const node = {
        type: 'SomeNode',
        widgets_values: ['', '  ', 'model_a.safetensors'],
        properties: {
          models: [
            {
              name: 'model_a.safetensors',
              url: 'https://example.com/model_a.safetensors',
              directory: 'checkpoints'
            }
          ]
        }
      }

      const result = getSelectedModelsMetadata(node)

      expect(result).toHaveLength(1)
      expect(result![0].name).toBe('model_a.safetensors')
    })

    it('should return undefined for nodes without model metadata', () => {
      const node = {
        type: 'SomeNode',
        widgets_values: ['model_a.safetensors']
      }

      const result = getSelectedModelsMetadata(node)

      expect(result).toBeUndefined()
    })

    it('should return undefined for nodes without widgets_values', () => {
      const node = {
        type: 'SomeNode',
        properties: {
          models: [
            {
              name: 'model_a.safetensors',
              url: 'https://example.com/model_a.safetensors',
              directory: 'checkpoints'
            }
          ]
        }
      }

      const result = getSelectedModelsMetadata(node)

      expect(result).toBeUndefined()
    })

    it('should return undefined for nodes with empty widgets_values', () => {
      const node = {
        type: 'SomeNode',
        widgets_values: [],
        properties: {
          models: [
            {
              name: 'model_a.safetensors',
              url: 'https://example.com/model_a.safetensors',
              directory: 'checkpoints'
            }
          ]
        }
      }

      const result = getSelectedModelsMetadata(node)

      expect(result).toBeUndefined()
    })

    it('should return undefined for nodes with empty models array', () => {
      const node = {
        type: 'SomeNode',
        widgets_values: ['model_a.safetensors'],
        properties: {
          models: []
        }
      }

      const result = getSelectedModelsMetadata(node)

      expect(result).toBeUndefined()
    })

    it('should handle object widget values', () => {
      const node = {
        type: 'SomeNode',
        widgets_values: {
          ckpt_name: 'model_a.safetensors',
          seed: 42
        },
        properties: {
          models: [
            {
              name: 'model_a.safetensors',
              url: 'https://example.com/model_a.safetensors',
              directory: 'checkpoints'
            },
            {
              name: 'model_b.safetensors',
              url: 'https://example.com/model_b.safetensors',
              directory: 'checkpoints'
            }
          ]
        }
      }

      const result = getSelectedModelsMetadata(node)

      expect(result).toHaveLength(1)
      expect(result![0].name).toBe('model_a.safetensors')
    })

    it('should work end-to-end to filter outdated metadata', () => {
      const node = {
        type: 'CheckpointLoaderSimple',
        widgets_values: ['current_model.safetensors'],
        properties: {
          models: [
            {
              name: 'current_model.safetensors',
              url: 'https://example.com/current_model.safetensors',
              directory: 'checkpoints'
            },
            {
              name: 'old_model.safetensors',
              url: 'https://example.com/old_model.safetensors',
              directory: 'checkpoints'
            }
          ]
        }
      }

      const result = getSelectedModelsMetadata(node)

      expect(result).toHaveLength(1)
      expect(result![0].name).toBe('current_model.safetensors')
    })
  })
})
