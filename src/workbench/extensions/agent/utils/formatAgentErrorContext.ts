import type {
  AgentErrorCategory,
  AgentErrorContext,
  AgentErrorContextScope,
  AgentErrorProblem
} from '../types/agentErrorContext'

const CATEGORY_LABELS: Record<AgentErrorCategory, string> = {
  missing_input: 'Missing input',
  missing_model: 'Missing model',
  missing_media: 'Missing media',
  missing_node: 'Missing node',
  validation: 'Validation error',
  execution_failure: 'Execution failure'
}

const SCOPE_NOTES: Record<AgentErrorContextScope, string> = {
  single: 'a single problem',
  card: "one issue card's group of problems",
  all: 'all problems currently listed in the Issues panel'
}

const MAX_PROBLEM_DETAILS_LENGTH = 1500

const GUIDANCE =
  'Use these supplied problems as the source of truth rather than inferring from the workflow alone. ' +
  'Re-check the current graph state before proposing changes, distinguish stale errors from current problems, ' +
  'and do not treat passing graph validation as resolving missing assets, inputs, or runtime failures. ' +
  'Ask me for any file or decision you cannot supply automatically.'

function formatNodeReference(problem: AgentErrorProblem): string {
  const parts: string[] = []
  if (problem.nodeTitle) parts.push(problem.nodeTitle)
  if (problem.nodeType && problem.nodeType !== problem.nodeTitle)
    parts.push(`type ${problem.nodeType}`)
  if (problem.nodeId) parts.push(`node #${problem.nodeId}`)
  return parts.join(', ')
}

function truncateDetails(details: string): string {
  const trimmed = details.trim()
  if (trimmed.length <= MAX_PROBLEM_DETAILS_LENGTH) return trimmed
  return `${trimmed.slice(0, MAX_PROBLEM_DETAILS_LENGTH)}… (truncated)`
}

function formatProblem(problem: AgentErrorProblem, index: number): string {
  const reference = formatNodeReference(problem)
  const lines = [
    `${index + 1}. [${CATEGORY_LABELS[problem.category]}]${
      reference ? ` ${reference}` : ''
    }`,
    `   ${problem.message.trim()}`
  ]
  if (problem.details?.trim()) {
    const details = truncateDetails(problem.details).replaceAll('\n', '\n   ')
    lines.push(`   Details: ${details}`)
  }
  return lines.join('\n')
}

/** Serializes an attached error context into the message content the agent receives. */
export function formatAgentErrorContext(
  context: AgentErrorContext,
  userText = ''
): string {
  const header: string[] = [
    `I need help with ${context.count} workflow ${
      context.count === 1 ? 'issue' : 'issues'
    } (${SCOPE_NOTES[context.scope]}).`
  ]
  if (context.workflowName?.trim())
    header.push(`Workflow: ${context.workflowName.trim()}`)
  if (context.scope === 'all' && context.searchQuery?.trim())
    header.push(
      `Issues panel filter in effect: "${context.searchQuery.trim()}"`
    )

  const block = [
    ...header,
    '',
    'Problems:',
    ...context.problems.map(formatProblem),
    '',
    GUIDANCE
  ].join('\n')

  const trimmedUser = userText.trim()
  return trimmedUser ? `${trimmedUser}\n\n${block}` : block
}
