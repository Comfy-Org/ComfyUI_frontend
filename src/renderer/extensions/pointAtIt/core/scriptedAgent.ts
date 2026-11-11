import type {
  AgentReply,
  AgentRequest,
  AnnotationNote,
  DescribedElement,
  ReplyAddress,
  ReplySettingAddress,
  ReplyStep
} from './agentReply'
import { answers } from './messages'
import type { HostNode, HostSetting } from './pointHost'

interface ScriptOptions {
  wrongTarget: boolean
}

interface NumberSetting {
  address: ReplySettingAddress
  value: number
}

const ASKS_WHAT = /\bwhat(['’]?s| is| does| are| do)\b|\bexplain\b/
const ASKS_SIZE =
  /\b(wider|narrower|taller|shorter|larger|bigger|smaller|size|resolution|width|height)\b/
const ASKS_HEIGHT = /\b(taller|shorter|height)\b/
const ASKS_SHRINK = /\b(narrower|shorter|smaller)\b/
const ASKS_STEPS = /\b(steps?|detail|detailed|faster|quicker|quality)\b/
const ASKS_FEWER = /\b(fewer|less|lower|reduce|faster|quicker)\b/

const SIZE_NODE_TYPE = /Empty.*Latent/i
const SAMPLER_NODE_TYPE = /KSampler/i
const SIZE_GRID = 64
const STEPS_DELTA = 10
const RUN: ReplyAddress = { kind: 'control', control: 'run' }

function numberValue(node: HostNode, name: string): number | undefined {
  const value = node.settings.find((setting) => setting.name === name)?.value
  return typeof value === 'number' ? value : undefined
}

function findNumberSetting(
  nodes: readonly HostNode[],
  name: string,
  preferredType: RegExp,
  alsoRequired: readonly string[] = []
): NumberSetting | null {
  const candidates = nodes.filter((node) =>
    [name, ...alsoRequired].every(
      (required) => numberValue(node, required) !== undefined
    )
  )
  const node =
    candidates.find((candidate) => preferredType.test(candidate.type)) ??
    candidates.at(0)
  const value = node && numberValue(node, name)
  if (!node || value === undefined) return null
  return {
    address: { kind: 'setting', nodeId: node.id, setting: name },
    value
  }
}

function say(
  note: AnnotationNote,
  text: string,
  target: ReplyAddress | null
): ReplyStep {
  return {
    annotationId: note.id,
    text,
    target,
    waitFor: null,
    offerEdit: null
  }
}

function unanswered(note: AnnotationNote, reason: string): ReplyStep {
  return say(note, `${reason}\n\n${answers.canAnswer}`, null)
}

function edit(
  note: AnnotationNote,
  found: NumberSetting,
  value: number,
  text: string
): ReplyStep {
  return {
    annotationId: note.id,
    text,
    target: found.address,
    waitFor: {
      for: 'valueChange',
      of: found.address,
      direction: value > found.value ? 'increase' : 'decrease'
    },
    offerEdit: { target: found.address, value }
  }
}

function resize(
  note: AnnotationNote,
  text: string,
  nodes: readonly HostNode[]
): ReplyStep {
  const name = ASKS_HEIGHT.test(text) ? 'height' : 'width'
  const found = findNumberSetting(nodes, name, SIZE_NODE_TYPE, [
    'width',
    'height'
  ])
  if (!found) return unanswered(note, answers.noSizeNode)
  const grows = !ASKS_SHRINK.test(text)
  const scaled = found.value * (grows ? 1.5 : 0.75)
  const value = Math.max(SIZE_GRID, Math.round(scaled / SIZE_GRID) * SIZE_GRID)
  return edit(note, found, value, answers.sizeLead(name, value, grows))
}

function changeSteps(
  note: AnnotationNote,
  text: string,
  nodes: readonly HostNode[]
): ReplyStep {
  const found = findNumberSetting(nodes, 'steps', SAMPLER_NODE_TYPE)
  if (!found) return unanswered(note, answers.noStepsNode)
  const more = !ASKS_FEWER.test(text)
  const value = more
    ? found.value + STEPS_DELTA
    : Math.max(1, found.value - STEPS_DELTA)
  return edit(note, found, value, answers.stepsLead(value, more))
}

function describedSetting(
  node: HostNode,
  setting: HostSetting
): { label: string; description: string } {
  return {
    label: `${node.title} › ${setting.label}`,
    description: setting.description
  }
}

function describeElement(
  note: AnnotationNote,
  element: DescribedElement
): ReplyStep {
  return say(note, answers.describeElement(element), {
    kind: 'element',
    elementId: element.elementId
  })
}

function describe(note: AnnotationNote, nodes: readonly HostNode[]): ReplyStep {
  const target = note.targets.at(0)
  if (!target || target.kind === 'element')
    return unanswered(note, answers.noScript)
  const node = nodes.find((candidate) => candidate.id === target.nodeId)
  if (!node) return unanswered(note, answers.noScript)
  const setting =
    target.kind === 'setting'
      ? node.settings.find((candidate) => candidate.name === target.setting)
      : undefined
  const { label, description } = setting
    ? describedSetting(node, setting)
    : { label: node.title, description: node.description }
  return say(
    note,
    description
      ? answers.describe(label, description)
      : answers.noDescription(label),
    target
  )
}

function answerNote(
  note: AnnotationNote,
  nodes: readonly HostNode[]
): ReplyStep {
  const pinnedOn = note.targets.at(0)
  if (pinnedOn?.kind === 'element') return describeElement(note, pinnedOn)
  const text = note.comment.toLowerCase()
  if (ASKS_WHAT.test(text)) return describe(note, nodes)
  if (ASKS_SIZE.test(text)) return resize(note, text, nodes)
  if (ASKS_STEPS.test(text)) return changeSteps(note, text, nodes)
  return unanswered(note, answers.noScript)
}

function withRunStep(steps: ReplyStep[]): ReplyStep[] {
  if (!steps.some((step) => step.offerEdit)) return steps
  return [
    ...steps,
    {
      annotationId: null,
      text: answers.runNext,
      target: RUN,
      waitFor: { for: 'run' },
      offerEdit: null
    }
  ]
}

function misdirected(
  steps: ReplyStep[],
  nodes: readonly HostNode[]
): ReplyStep[] {
  const first = steps.at(0)
  if (!first?.target || first.target.kind === 'control') return steps
  if (first.target.kind === 'element') return steps
  const rightId = first.target.nodeId
  const rightIndex = nodes.findIndex((node) => node.id === rightId)
  const others = [
    ...nodes.slice(rightIndex + 1),
    ...nodes.slice(0, Math.max(rightIndex, 0))
  ].filter((node) => node.id !== rightId)
  const wrong = others.find((node) => node.rect) ?? others.at(0)
  if (!wrong) return steps
  return [
    {
      annotationId: first.annotationId,
      text: first.text,
      target: { kind: 'node', nodeId: wrong.id },
      waitFor: null,
      offerEdit: null
    },
    ...steps.slice(1)
  ]
}

/** The stand-in agent: a fixed script keyed on words in each comment. */
export function answerRequest(
  request: AgentRequest,
  nodes: readonly HostNode[],
  options: ScriptOptions
): AgentReply {
  const steps = withRunStep(
    request.annotations.map((note) => answerNote(note, nodes))
  )
  return { steps: options.wrongTarget ? misdirected(steps, nodes) : steps }
}
