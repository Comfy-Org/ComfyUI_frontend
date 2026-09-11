import {
  getCurrentInstance,
  onActivated,
  onDeactivated,
  onScopeDispose
} from 'vue'

import type { RuntimeKeybinding } from './runtimeKeybindingStore'
import { useRuntimeKeybindingStore } from './runtimeKeybindingStore'

export function useKeybinding(options: RuntimeKeybinding) {
  const runtime = useRuntimeKeybindingStore()
  let dispose: (() => void) | undefined
  function register() {
    dispose ??= runtime.register(options)
  }
  function unregister() {
    dispose?.()
    dispose = undefined
  }
  register()
  if (getCurrentInstance()) {
    onActivated(register)
    onDeactivated(unregister)
  }
  onScopeDispose(unregister)
}
