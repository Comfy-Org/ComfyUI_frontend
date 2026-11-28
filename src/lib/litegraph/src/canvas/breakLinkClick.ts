import { LiteGraph } from '@/lib/litegraph/src/litegraphInstance'

export function isBreakLinkClick(
  event: Pick<MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>
): boolean {
  return (
    LiteGraph.ctrl_alt_click_do_break_link &&
    (event.ctrlKey || event.metaKey) &&
    event.altKey &&
    !event.shiftKey
  )
}
