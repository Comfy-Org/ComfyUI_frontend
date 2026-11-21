import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'

/** False for a muted or bypassed node, whose outputs the host's own rules decide. */
export function runs({ mode }: { readonly mode: LGraphEventMode }): boolean {
  return mode !== LGraphEventMode.NEVER && mode !== LGraphEventMode.BYPASS
}
