import type {
  AgentQuestion,
  AgentReply,
  GuidanceStep,
  NodeAddress,
  SettingAddress,
  TargetAddress
} from './agentReply'
import { answers } from './messages'
import type { HostNode, HostSetting } from './pointHost'

export interface ScriptOptions {
  wrongTarget: boolean
}

interface NumberSetting {
  node: HostNode
  address: SettingAddress
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
const RUN: TargetAddress = { kind: 'control', control: 'run' }

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
    node,
    address: { kind: 'setting', nodeId: node.id, setting: name },
    value
  }
}

function unanswered(reason: string): GuidanceStep[] {
  return [{ text: `${reason}\n\n${answers.canAnswer}`, target: null }]
}

function editThenRun(
  found: NumberSetting,
  value: number,
  text: string
): GuidanceStep[] {
  return [
    {
      text,
      target: found.address,
      waitFor: {
        for: 'valueChange',
        of: found.address,
        direction: value > found.value ? 'increase' : 'decrease'
      },
      offerEdit: { target: found.address, value }
    },
    { text: answers.runNext, target: RUN, waitFor: { for: 'run' } }
  ]
}

function resize(text: string, nodes: readonly HostNode[]): GuidanceStep[] {
  const name = ASKS_HEIGHT.test(text) ? 'height' : 'width'
  const found = findNumberSetting(nodes, name, SIZE_NODE_TYPE, [
    'width',
    'height'
  ])
  if (!found) return unanswered(answers.noSizeNode)
  const grows = !ASKS_SHRINK.test(text)
  const scaled = found.value * (grows ? 1.5 : 0.75)
  const value = Math.max(SIZE_GRID, Math.round(scaled / SIZE_GRID) * SIZE_GRID)
  return editThenRun(found, value, answers.sizeLead(name, value, grows))
}

function changeSteps(text: string, nodes: readonly HostNode[]): GuidanceStep[] {
  const found = findNumberSetting(nodes, 'steps', SAMPLER_NODE_TYPE)
  if (!found) return unanswered(answers.noStepsNode)
  const more = !ASKS_FEWER.test(text)
  const value = more
    ? found.value + STEPS_DELTA
    : Math.max(1, found.value - STEPS_DELTA)
  return editThenRun(found, value, answers.stepsLead(value, more))
}

function isGraphAddress(
  address: TargetAddress
): address is NodeAddress | SettingAddress {
  return address.kind !== 'control'
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

function describe(
  marked: readonly TargetAddress[],
  nodes: readonly HostNode[]
): GuidanceStep[] {
  const target = marked.find(isGraphAddress)
  const node =
    target && nodes.find((candidate) => candidate.id === target.nodeId)
  if (!target || !node)
    return [{ text: answers.nothingToDescribe, target: null }]
  const setting =
    target.kind === 'setting'
      ? node.settings.find((candidate) => candidate.name === target.setting)
      : undefined
  const { label, description } = setting
    ? describedSetting(node, setting)
    : { label: node.title, description: node.description }
  return [
    {
      text: description
        ? answers.describe(label, description)
        : answers.noDescription(label),
      target
    }
  ]
}

function scriptedSteps(
  question: AgentQuestion,
  nodes: readonly HostNode[]
): GuidanceStep[] {
  const text = question.text.toLowerCase()
  if (ASKS_WHAT.test(text)) return describe(question.marked, nodes)
  if (ASKS_SIZE.test(text)) return resize(text, nodes)
  if (ASKS_STEPS.test(text)) return changeSteps(text, nodes)
  return unanswered(answers.noScript)
}

function misdirected(
  steps: GuidanceStep[],
  nodes: readonly HostNode[]
): GuidanceStep[] {
  const first = steps.at(0)
  if (!first?.target || first.target.kind === 'control') return steps
  const rightId = first.target.nodeId
  const rightIndex = nodes.findIndex((node) => node.id === rightId)
  const others = [
    ...nodes.slice(rightIndex + 1),
    ...nodes.slice(0, Math.max(rightIndex, 0))
  ].filter((node) => node.id !== rightId)
  const wrong = others.find((node) => node.rect) ?? others.at(0)
  if (!wrong) return steps
  return [
    { text: first.text, target: { kind: 'node', nodeId: wrong.id } },
    ...steps.slice(1)
  ]
}

/** The stand-in agent: a fixed script keyed on words in the question. */
export function answerQuestion(
  question: AgentQuestion,
  nodes: readonly HostNode[],
  options: ScriptOptions
): AgentReply {
  const steps = scriptedSteps(question, nodes)
  return {
    questionId: question.questionId,
    steps: options.wrongTarget ? misdirected(steps, nodes) : steps
  }
}
