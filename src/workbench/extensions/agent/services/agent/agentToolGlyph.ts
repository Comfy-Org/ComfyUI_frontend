import type { PartState } from './agentMessageParts'

interface KnownTool {
  labelKey: string
  icon: string
}

// Label and icon live in one entry so a tool can never render one without the
// other, or drift into a mismatched pair.
const KNOWN_TOOLS: Record<string, KnownTool> = {
  new_tab: { labelKey: 'agent.toolOpenedNewTab', icon: 'icon-[lucide--plus]' },
  switch_tab: {
    labelKey: 'agent.toolSwitchedTabs',
    icon: 'icon-[lucide--arrow-left-right]'
  },
  remember: {
    labelKey: 'agent.toolSavedPreference',
    icon: 'icon-[lucide--save]'
  },
  forget: {
    labelKey: 'agent.toolForgotPreference',
    icon: 'icon-[lucide--circle-question-mark]'
  }
}

// hasOwn, not a bare index: a tool named "constructor" would otherwise resolve
// to something off Object.prototype.
export function knownTool(name: string): KnownTool | undefined {
  return Object.hasOwn(KNOWN_TOOLS, name) ? KNOWN_TOOLS[name] : undefined
}

export function toolGlyph(
  name: string,
  state: PartState,
  ok?: boolean
): string {
  if (state === 'streaming') return 'animate-spin icon-[lucide--loader-circle]'
  if (ok === false) return 'icon-[lucide--circle-x]'
  return knownTool(name)?.icon ?? 'icon-[lucide--wrench]'
}
