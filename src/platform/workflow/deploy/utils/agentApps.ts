export type AgentApp = 'claude' | 'chatGpt'

const AGENT_APP_LINKS: Record<AgentApp, (encodedPrompt: string) => string> = {
  claude: (encodedPrompt) => `claude://code/new?q=${encodedPrompt}`,
  chatGpt: (encodedPrompt) => `codex://new?prompt=${encodedPrompt}`
}

const SURROGATES = /([\uD800-\uDBFF][\uDC00-\uDFFF])|[\uD800-\uDFFF]/g

function wellFormed(text: string): string {
  return text.replace(SURROGATES, (_, pair?: string) => pair ?? '\uFFFD')
}

function agentAppUrl(app: AgentApp, prompt: string): string {
  return AGENT_APP_LINKS[app](encodeURIComponent(wellFormed(prompt)))
}

const LAUNCHER_FRAME_ID = 'agent-app-launcher'

function hiddenLauncherFrame(): HTMLIFrameElement {
  const existing = document.getElementById(LAUNCHER_FRAME_ID)
  if (existing instanceof HTMLIFrameElement) return existing
  const frame = document.createElement('iframe')
  frame.id = LAUNCHER_FRAME_ID
  frame.hidden = true
  return document.body.appendChild(frame)
}

/** Starts a new session in the desktop app with the prompt in its composer, unsent. */
export function openAgentApp(app: AgentApp, prompt: string): void {
  hiddenLauncherFrame().src = agentAppUrl(app, prompt)
}
