import { skipLeavePromptOnce } from '@/platform/workflow/management/leavePrompt'

export type AgentApp = 'claude' | 'codex'

const AGENT_APP_LINKS: Record<AgentApp, (encodedPrompt: string) => string> = {
  claude: (encodedPrompt) => `claude://code/new?q=${encodedPrompt}`,
  codex: (encodedPrompt) => `codex://new?prompt=${encodedPrompt}`
}

const SURROGATES = /([\uD800-\uDBFF][\uDC00-\uDFFF])|[\uD800-\uDFFF]/g

function wellFormed(text: string): string {
  return text.replace(SURROGATES, (_, pair?: string) => pair ?? '\uFFFD')
}

function agentAppUrl(app: AgentApp, prompt: string): string {
  return AGENT_APP_LINKS[app](encodeURIComponent(wellFormed(prompt)))
}

/** Starts a new session in the desktop app with the prompt in its composer, unsent. */
export function openAgentApp(app: AgentApp, prompt: string): void {
  const keepLeavePrompt = skipLeavePromptOnce()
  try {
    window.location.assign(agentAppUrl(app, prompt))
  } finally {
    keepLeavePrompt()
  }
}
