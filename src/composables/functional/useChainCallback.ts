import { chainCallback } from '@/lib/litegraph/src/utils/chainCallback'

export function useChainCallback<O, Args extends unknown[], Result = void>(
  originalCallback: ((this: O, ...args: Args) => Result) | undefined,
  ...callbacks: ((this: O, ...args: Args) => void)[]
) {
  return chainCallback(originalCallback, ...callbacks)
}
