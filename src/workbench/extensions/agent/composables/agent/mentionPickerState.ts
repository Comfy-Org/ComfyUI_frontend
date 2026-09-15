export type MentionSection = 'root' | 'nodes' | 'workflows'

export type MentionPickerState =
  | { status: 'closed' }
  | {
      status: 'open'
      section: MentionSection
      start: number
      query: string
      activeIndex: number
    }

export type MentionPickerEvent =
  | {
      type: 'queryChanged'
      start: number
      query: string
      firstMatchIndex: number
    }
  | { type: 'sectionSelected'; section: Exclude<MentionSection, 'root'> }
  | { type: 'back' }
  | { type: 'nodesUnavailable'; firstMatchIndex: number }
  | {
      type: 'highlightMoved'
      direction: 1 | -1
      disabled: readonly boolean[]
    }
  | { type: 'highlighted'; index: number }
  | { type: 'closed' }

export function transitionMentionPicker(
  state: MentionPickerState,
  event: MentionPickerEvent
): MentionPickerState {
  if (event.type === 'closed') return { status: 'closed' }
  if (event.type === 'queryChanged') {
    const section = state.status === 'open' ? state.section : 'root'
    return {
      status: 'open',
      section,
      start: event.start,
      query: event.query,
      activeIndex:
        section !== 'root' && event.query === ''
          ? 0
          : Math.max(0, event.firstMatchIndex)
    }
  }
  if (state.status === 'closed') return state

  switch (event.type) {
    case 'sectionSelected':
      return { ...state, section: event.section, query: '', activeIndex: 0 }
    case 'back':
      return { ...state, section: 'root', activeIndex: 0 }
    case 'nodesUnavailable':
      return state.section === 'nodes'
        ? {
            ...state,
            section: 'root',
            activeIndex: Math.max(0, event.firstMatchIndex)
          }
        : state
    case 'highlighted':
      return { ...state, activeIndex: event.index }
    case 'highlightMoved': {
      const count = event.disabled.length
      for (let offset = 1; offset <= count; offset++) {
        const index =
          (state.activeIndex + event.direction * offset + count) % count
        if (!event.disabled[index]) return { ...state, activeIndex: index }
      }
      return state
    }
  }
}
