import { agentReplySchema } from './agentReply'
import type {
  AgentRequest,
  DescribedElement,
  ReplyAddress,
  ReplySettingAddress,
  ReplyStep
} from './agentReply'
import { problems } from './messages'
import type { HostNode, HostSetting } from './pointHost'
import type {
  SettingAddress,
  SettingValue,
  TargetAddress
} from './targetAddress'

export type StepWait =
  | {
      for: 'valueChange'
      of: SettingAddress
      direction: 'increase' | 'decrease' | null
    }
  | { for: 'run' }

interface OfferedEdit {
  target: SettingAddress
  value: SettingValue
}

/** A reply step whose every address exists in the workflow. */
export interface GuidanceStep {
  annotationId: string | null
  text: string
  target: TargetAddress | null
  waitFor: StepWait | null
  offerEdit: OfferedEdit | null
  /** What the check removed, in words the bubble shows. */
  problems: string[]
}

interface Checked<T> {
  value: T | null
  problem: string | null
}

function found<T>(value: T | null): Checked<T> {
  return { value, problem: null }
}

function missing(problem: string | null): Checked<never> {
  return { value: null, problem }
}

function findSetting(
  nodes: readonly HostNode[],
  address: ReplySettingAddress
): { node: HostNode; setting: HostSetting } | null {
  const node = nodes.find((candidate) => candidate.id === address.nodeId)
  const setting = node?.settings.find(
    (candidate) => candidate.name === address.setting
  )
  return node && setting ? { node, setting } : null
}

function checkSetting(
  address: ReplySettingAddress,
  nodes: readonly HostNode[]
): Checked<SettingAddress> {
  const hit = findSetting(nodes, address)
  if (!hit) return missing(problems.unknownSetting(address))
  return found({
    kind: 'setting',
    nodeId: hit.node.id,
    setting: hit.setting.name
  })
}

function annotatedElements(request: AgentRequest): DescribedElement[] {
  return request.annotations.flatMap((annotation) =>
    annotation.targets.filter((target) => target.kind === 'element')
  )
}

function checkTarget(
  address: ReplyAddress | null,
  request: AgentRequest,
  nodes: readonly HostNode[]
): Checked<TargetAddress> {
  if (!address || address.kind === 'control') return found(address)
  if (address.kind === 'setting') return checkSetting(address, nodes)
  if (address.kind === 'element') {
    const element = annotatedElements(request).find(
      (candidate) => candidate.elementId === address.elementId
    )
    return element
      ? found<TargetAddress>(element)
      : missing(problems.unknownElement(address.elementId))
  }
  const node = nodes.find((candidate) => candidate.id === address.nodeId)
  if (!node) return missing(problems.unknownNode(address.nodeId))
  return found({ kind: 'node', nodeId: node.id })
}

function checkWait(
  wait: ReplyStep['waitFor'],
  nodes: readonly HostNode[]
): Checked<StepWait> {
  if (!wait || wait.for === 'run') return found(wait)
  const of = checkSetting(wait.of, nodes)
  if (!of.value) return missing(of.problem)
  return found({ for: 'valueChange', of: of.value, direction: wait.direction })
}

function accepts(setting: HostSetting, value: SettingValue): boolean {
  if (setting.options) return setting.options.includes(value)
  return setting.value === undefined || typeof setting.value === typeof value
}

function checkOffer(
  offer: ReplyStep['offerEdit'],
  nodes: readonly HostNode[]
): Checked<OfferedEdit> {
  if (!offer) return found<OfferedEdit>(null)
  const target = checkSetting(offer.target, nodes)
  const hit = findSetting(nodes, offer.target)
  if (!target.value || !hit) return missing(target.problem)
  if (!accepts(hit.setting, offer.value))
    return missing(problems.valueNotAccepted(hit.setting.label, offer.value))
  return found({ target: target.value, value: offer.value })
}

function checkStep(
  step: ReplyStep,
  request: AgentRequest,
  nodes: readonly HostNode[]
): GuidanceStep {
  const target = checkTarget(step.target, request, nodes)
  const wait = checkWait(step.waitFor, nodes)
  const offer = checkOffer(step.offerEdit, nodes)
  const answersKnownComment = request.annotations.some(
    (annotation) => annotation.id === step.annotationId
  )
  const answersEarlierTurn = request.history.some((turn) =>
    turn.comments.some((comment) => comment.id === step.annotationId)
  )
  const removed = [
    target.problem,
    wait.problem,
    offer.problem,
    answersEarlierTurn ? problems.earlierComment : null
  ].filter((problem) => problem !== null)
  return {
    annotationId: answersKnownComment ? step.annotationId : null,
    text: step.text,
    target: target.value,
    waitFor: target.problem ? null : wait.value,
    offerEdit: target.problem ? null : offer.value,
    problems: [...new Set(removed)]
  }
}

/**
 * Checks an agent's raw reply against the workflow before anything moves.
 * Returns null when the reply is not in the reply format.
 */
export function checkReply(
  raw: unknown,
  request: AgentRequest,
  nodes: readonly HostNode[]
): GuidanceStep[] | null {
  const parsed = agentReplySchema.safeParse(raw)
  if (!parsed.success || parsed.data.steps.length === 0) return null
  return parsed.data.steps.map((step) => checkStep(step, request, nodes))
}
