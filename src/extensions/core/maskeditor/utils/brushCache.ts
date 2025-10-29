import { debounce } from 'es-toolkit/compat'
import { getStorageValue, setStorageValue } from '@/scripts/utils'
import type { Brush } from '../types'

export const saveBrushToCache = debounce(function (
  key: string,
  brush: Brush
): void {
  try {
    const brushString = JSON.stringify(brush)
    setStorageValue(key, brushString)
  } catch (error) {
    console.error('Failed to save brush to cache:', error)
  }
}, 300)

export function loadBrushFromCache(key: string): Brush | null {
  try {
    const brushString = getStorageValue(key)
    if (brushString) {
      const brush = JSON.parse(brushString) as Brush
      console.log('Loaded brush from cache:', brush)
      return brush
    } else {
      console.log('No brush found in cache.')
      return null
    }
  } catch (error) {
    console.error('Failed to load brush from cache:', error)
    return null
  }
}
