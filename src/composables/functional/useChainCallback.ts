import type {
  Callable,
  ChainedCallback
} from '@/lib/litegraph/src/utils/chainCallback'
import { chainCallback } from '@/lib/litegraph/src/utils/chainCallback'

export function useChainCallback<O, T extends Callable>(
  originalCallback: T | undefined,
  ...callbacks: ChainedCallback<O, T>[]
) {
  return chainCallback<O, T>(originalCallback, ...callbacks)
}
