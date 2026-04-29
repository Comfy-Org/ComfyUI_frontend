import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { UserProperties } from '@/platform/assets/schemas/userPropertySchema'

import { useMultiPropertyEditing } from './useMultiPropertyEditing'

function createAsset(
  id: string,
  userProperties: UserProperties = {}
): AssetItem {
  return {
    id,
    name: `${id}.png`,
    tags: [],
    user_metadata: { user_properties: userProperties }
  }
}

describe('useMultiPropertyEditing', () => {
  function setup(
    assets: AssetItem[],
    pending: Record<string, Record<string, unknown>> = {}
  ) {
    const allAssets = ref(assets)
    const pendingByAsset = ref(pending)
    const flush = vi.fn()
    const result = useMultiPropertyEditing(allAssets, pendingByAsset, flush)
    return { ...result, pendingByAsset, flush }
  }

  describe('multiPropertyCounts', () => {
    it('counts property keys across assets', () => {
      const { multiPropertyCounts } = setup([
        createAsset('a', {
          caption: { type: 'string', value: 'hello' },
          rating: { type: 'number', value: 3 }
        }),
        createAsset('b', {
          caption: { type: 'string', value: 'world' }
        }),
        createAsset('c', {})
      ])

      expect(multiPropertyCounts.value.get('caption')).toBe(2)
      expect(multiPropertyCounts.value.get('rating')).toBe(1)
    })

    it('respects pending overrides', () => {
      const { multiPropertyCounts } = setup(
        [createAsset('a', {}), createAsset('b', {})],
        {
          a: {
            user_properties: {
              newProp: { type: 'string', value: 'val' }
            }
          }
        }
      )

      expect(multiPropertyCounts.value.get('newProp')).toBe(1)
    })
  })

  describe('multiMixedKeys', () => {
    it('detects keys with differing values', () => {
      const { multiMixedKeys } = setup([
        createAsset('a', {
          caption: { type: 'string', value: 'hello' }
        }),
        createAsset('b', {
          caption: { type: 'string', value: 'world' }
        })
      ])

      expect(multiMixedKeys.value.has('caption')).toBe(true)
    })

    it('does not mark keys with same values as mixed', () => {
      const { multiMixedKeys } = setup([
        createAsset('a', {
          favorite: { type: 'boolean', value: true }
        }),
        createAsset('b', {
          favorite: { type: 'boolean', value: true }
        })
      ])

      expect(multiMixedKeys.value.has('favorite')).toBe(false)
    })

    it('does not mark keys absent from some assets as mixed', () => {
      const { multiMixedKeys } = setup([
        createAsset('a', {
          rating: { type: 'number', value: 5 }
        }),
        createAsset('b', {})
      ])

      expect(multiMixedKeys.value.has('rating')).toBe(false)
    })

    it('detects mixed when types differ for same key', () => {
      const { multiMixedKeys } = setup([
        createAsset('a', {
          rating: { type: 'number', value: 5 }
        }),
        createAsset('b', {
          rating: { type: 'string', value: '5' }
        })
      ])

      expect(multiMixedKeys.value.has('rating')).toBe(true)
    })
  })

  describe('multiUserProperties getter', () => {
    it('returns union of all property keys', () => {
      const { multiUserProperties } = setup([
        createAsset('a', {
          caption: { type: 'string', value: 'hello' }
        }),
        createAsset('b', {
          rating: { type: 'number', value: 4 }
        })
      ])

      expect(Object.keys(multiUserProperties.value)).toContain('caption')
      expect(Object.keys(multiUserProperties.value)).toContain('rating')
    })

    it('picks first asset value as representative', () => {
      const { multiUserProperties } = setup([
        createAsset('a', {
          caption: { type: 'string', value: 'first' }
        }),
        createAsset('b', {
          caption: { type: 'string', value: 'second' }
        })
      ])

      expect(multiUserProperties.value.caption.value).toBe('first')
    })

    it('preserves stable order: existing keys keep position, new keys append', () => {
      const assets = ref([
        createAsset('a', {
          beta: { type: 'string', value: '' },
          alpha: { type: 'string', value: '' }
        }),
        createAsset('b', {
          beta: { type: 'string', value: '' }
        })
      ])
      const pendingByAsset = ref({})
      const flush = vi.fn()
      const { multiUserProperties } = useMultiPropertyEditing(
        assets,
        pendingByAsset,
        flush
      )

      // Initial order: beta and alpha encountered in asset a's key order
      const initialKeys = Object.keys(multiUserProperties.value)
      expect(initialKeys).toContain('beta')
      expect(initialKeys).toContain('alpha')

      // Add a property — it should append, not reorder
      multiUserProperties.value = {
        ...multiUserProperties.value,
        zulu: { type: 'string', value: 'new' }
      }

      const afterAdd = Object.keys(multiUserProperties.value)
      expect(afterAdd[afterAdd.length - 1]).toBe('zulu')
    })
  })

  describe('multiUserProperties setter', () => {
    it('adds a new property to all assets', () => {
      const { multiUserProperties, pendingByAsset, flush } = setup([
        createAsset('a', {}),
        createAsset('b', {})
      ])

      multiUserProperties.value = {
        caption: { type: 'string', value: 'new' }
      }

      const pendingA = pendingByAsset.value.a?.user_properties as UserProperties
      const pendingB = pendingByAsset.value.b?.user_properties as UserProperties
      expect(pendingA.caption.value).toBe('new')
      expect(pendingB.caption.value).toBe('new')
      expect(flush).toHaveBeenCalled()
    })

    it('removes a property from all assets that have it', () => {
      const { multiUserProperties, pendingByAsset, flush } = setup([
        createAsset('a', {
          caption: { type: 'string', value: 'hello' }
        }),
        createAsset('b', {
          caption: { type: 'string', value: 'world' }
        }),
        createAsset('c', {})
      ])

      // Set to empty (all properties removed)
      multiUserProperties.value = {}

      const pendingA = pendingByAsset.value.a?.user_properties as UserProperties
      const pendingB = pendingByAsset.value.b?.user_properties as UserProperties
      expect(pendingA.caption).toBeUndefined()
      expect(pendingB.caption).toBeUndefined()
      // Asset c had no properties, should have no pending changes
      expect(pendingByAsset.value.c).toBeUndefined()
      expect(flush).toHaveBeenCalled()
    })

    it('updates a value on all assets', () => {
      const { multiUserProperties, pendingByAsset } = setup([
        createAsset('a', {
          rating: { type: 'number', value: 3 }
        }),
        createAsset('b', {
          rating: { type: 'number', value: 5 }
        }),
        createAsset('c', {})
      ])

      multiUserProperties.value = {
        rating: { type: 'number', value: 4 }
      }

      const propsA = pendingByAsset.value.a?.user_properties as UserProperties
      const propsB = pendingByAsset.value.b?.user_properties as UserProperties
      const propsC = pendingByAsset.value.c?.user_properties as UserProperties
      expect(propsA.rating.value).toBe(4)
      expect(propsB.rating.value).toBe(4)
      expect(propsC.rating.value).toBe(4)
    })

    it('does not flush when nothing changed', () => {
      const { multiUserProperties, flush } = setup([
        createAsset('a', {
          caption: { type: 'string', value: 'hello' }
        })
      ])

      // Set to the same value
      multiUserProperties.value = {
        caption: { type: 'string', value: 'hello' }
      }

      expect(flush).not.toHaveBeenCalled()
    })
  })
})
