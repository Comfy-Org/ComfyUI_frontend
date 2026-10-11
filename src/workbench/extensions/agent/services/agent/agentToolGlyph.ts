import { upperFirst } from 'es-toolkit'

import type { PartState } from './agentMessageParts'

interface KnownTool {
  labelKey: string
  activeLabelKey: string
  icon: string
}

// Label and icon live in one entry so a tool can never render one without the
// other, or drift into a mismatched pair. The active label is the present-tense
// twin of the finished one: motion on screen and tense in the copy change together.
const KNOWN_TOOLS: Record<string, KnownTool> = {
  new_tab: {
    labelKey: 'agent.toolOpenedNewTab',
    activeLabelKey: 'agent.toolOpeningNewTab',
    icon: 'icon-[lucide--plus]'
  },
  switch_tab: {
    labelKey: 'agent.toolSwitchedTabs',
    activeLabelKey: 'agent.toolSwitchingTabs',
    icon: 'icon-[lucide--arrow-left-right]'
  },
  remember: {
    labelKey: 'agent.toolSavedPreference',
    activeLabelKey: 'agent.toolSavingPreference',
    icon: 'icon-[lucide--save]'
  },
  forget: {
    labelKey: 'agent.toolForgotPreference',
    activeLabelKey: 'agent.toolForgettingPreference',
    icon: 'icon-[lucide--circle-question-mark]'
  }
}

// hasOwn, not a bare index: a tool named "constructor" would otherwise resolve
// to something off Object.prototype.
function knownTool(name: string): KnownTool | undefined {
  return Object.hasOwn(KNOWN_TOOLS, name) ? KNOWN_TOOLS[name] : undefined
}

export function toolLabel(
  name: string,
  state: PartState,
  translate: (key: string) => string
): string {
  const known = knownTool(name)
  if (known)
    return translate(
      state === 'streaming' ? known.activeLabelKey : known.labelKey
    )
  return upperFirst(name.replaceAll('_', ' '))
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
