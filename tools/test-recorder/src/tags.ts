export interface TagInfo {
  tag: string
  hint: string
  description: string
}

export const TAG_REGISTRY: readonly TagInfo[] = [
  {
    tag: '@smoke',
    hint: 'the most important everyday flows',
    description: 'Marks a core critical-path test for the smoke suite.'
  },
  {
    tag: '@slow',
    hint: 'takes a while to run',
    description: 'Marks a long-running test that is excluded from quick runs.'
  },
  {
    tag: '@screenshot',
    hint: 'compares the screen to a saved image',
    description: 'Marks a test that performs screenshot comparison.'
  },
  {
    tag: '@canvas',
    hint: 'moving around the graph area',
    description: 'Makes tests for canvas and graph interactions discoverable.'
  },
  {
    tag: '@node',
    hint: 'how nodes behave',
    description: 'Makes tests of node behavior discoverable.'
  },
  {
    tag: '@widget',
    hint: 'controls inside nodes (sliders, text boxes)',
    description: 'Makes tests of node widgets discoverable.'
  },
  {
    tag: '@vue-nodes',
    hint: 'the new-style node rendering',
    description: 'Makes tests of Vue-rendered nodes discoverable.'
  },
  {
    tag: '@subgraph',
    hint: 'groups of nodes nested inside a node',
    description: 'Makes tests of subgraph functionality discoverable.'
  },
  {
    tag: '@ui',
    hint: 'menus, dialogs, general interface',
    description: 'Makes tests of general user-interface behavior discoverable.'
  }
]

function knownTags(): string[] {
  return TAG_REGISTRY.map(({ tag }) => tag)
}

function knownTagsWithHints(): string[] {
  return TAG_REGISTRY.map(({ tag, hint }) => `${tag} (${hint})`)
}

export function unknownTagWarningLines(unknown: string[]): string[] {
  return [
    `Unknown tag(s) dropped: ${unknown.join(', ')}`,
    `Known tags: ${knownTagsWithHints().join(', ')}`
  ]
}

export function filterKnownTags(tags: string[]): {
  kept: string[]
  unknown: string[]
} {
  const known = new Set(knownTags())
  const kept: string[] = []
  const unknown: string[] = []

  for (const tag of tags) {
    ;(known.has(tag) ? kept : unknown).push(tag)
  }

  return { kept, unknown }
}
