/** Back from a checkout step, the frame's close, the finished checkout's close, or the surface's link to the host. */
export type WebReturnControl = 'back' | 'close' | 'success_close' | 'host_link'

export type WebReturnBillingEvent = {
  operation: 'web_return'
  stage: 'clicked'
  outcome: 'pending'
  control: WebReturnControl
}
