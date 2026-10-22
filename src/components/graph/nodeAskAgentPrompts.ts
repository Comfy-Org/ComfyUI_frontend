type NodeAskAgentPromptId = 'explain' | 'fixError' | 'whatElse' | 'enhance'

export interface NodeAskAgentPrompt {
  id: NodeAskAgentPromptId
  labelKey: string
  fillKey: string
  icon: string
}

const REGULAR_NODE_ASK_PROMPTS = [
  {
    id: 'explain',
    labelKey: 'agent.nodeHover.explain',
    fillKey: 'agent.nodeHover.explain',
    icon: 'icon-[lucide--message-circle-question-mark]'
  },
  {
    id: 'fixError',
    labelKey: 'agent.nodeHover.fixError',
    fillKey: 'agent.nodeHover.fixError',
    icon: 'icon-[lucide--wrench]'
  },
  {
    id: 'whatElse',
    labelKey: 'agent.nodeHover.whatElse',
    fillKey: 'agent.nodeHover.whatElse',
    icon: 'icon-[lucide--lightbulb]'
  }
] as const satisfies readonly NodeAskAgentPrompt[]

const PARTNER_NODE_ASK_PROMPTS = [
  {
    id: 'enhance',
    labelKey: 'agent.nodeHover.enhance',
    fillKey: 'agent.nodeHover.enhanceFill',
    icon: 'icon-[lucide--wand-sparkles]'
  },
  {
    id: 'fixError',
    labelKey: 'agent.nodeHover.fixError',
    fillKey: 'agent.nodeHover.fixError',
    icon: 'icon-[lucide--wrench]'
  },
  {
    id: 'whatElse',
    labelKey: 'agent.nodeHover.whatElse',
    fillKey: 'agent.nodeHover.whatElse',
    icon: 'icon-[lucide--lightbulb]'
  }
] as const satisfies readonly NodeAskAgentPrompt[]

export function nodeAskAgentPrompts(
  isPartner: boolean
): readonly NodeAskAgentPrompt[] {
  return isPartner ? PARTNER_NODE_ASK_PROMPTS : REGULAR_NODE_ASK_PROMPTS
}

export function rotateNodeAskAgentPrompts<T>(
  prompts: readonly T[],
  offset: number
): T[] {
  if (prompts.length === 0) return []
  const start = ((offset % prompts.length) + prompts.length) % prompts.length
  return prompts.slice(start).concat(prompts.slice(0, start))
}

export function nextNodeAskAgentShuffleOffset(
  offset: number,
  count: number
): number {
  if (count <= 0) return 0
  return (offset + 1) % count
}
