import { needsOwnEndpoint } from '../../config/workshop-launch'

/** How far a workflow can be taken without the reader building anything. */
export type WorkflowReach =
  /** The page runs it inline, through one call to a catalogue model. */
  | 'here'
  /** The page runs it against Cloud: the request carries the whole graph. */
  | 'cloud'
  /** Nothing shared can run it. A developer deploys it before calling it. */
  | 'endpoint'

/**
 * Both `here` and `cloud` run in the visitor's browser; they differ only in
 * which engine the browser talks to. Only `endpoint` cannot run at all.
 *
 * This used to also infer `endpoint` from the packs a graph declares against
 * a committed list of Cloud's nodes. That inference was wrong: the list is a
 * fallback snapshot taken on 22 August, it holds 61 packs, and absence from
 * it is not absence from Cloud. It marked three workflows the workflow
 * prototype runs against Cloud for real. What is left is the one workflow
 * that genuinely has a server of its own, which that prototype also declines
 * to run.
 */
export function workflowReach(
  templateName: string,
  runsInline: boolean
): WorkflowReach {
  if (needsOwnEndpoint(templateName)) return 'endpoint'
  return runsInline ? 'here' : 'cloud'
}
