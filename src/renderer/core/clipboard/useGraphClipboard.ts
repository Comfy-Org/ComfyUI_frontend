import { useCopy } from './useCopy'
import { usePaste } from './usePaste'

export function useGraphClipboard(): void {
  useCopy()
  usePaste()
}
