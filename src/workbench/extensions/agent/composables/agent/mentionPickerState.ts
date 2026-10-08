export type MentionSection = 'root' | 'nodes' | 'workflows' | 'skills'

type OpenMentionPickerState = {
  status: 'open'
  section: MentionSection
  start: number
  query: string
  activeIndex: number
}

export type MentionPickerState = { status: 'closed' } | OpenMentionPickerState

type QueryChangedEvent = {
  type: 'queryChanged'
  start: number
  query: string
  firstMatchIndex: number
  trigger?: '@' | '/'
}

export type MentionPickerEvent =
  | QueryChangedEvent
  | { type: 'sectionSelected'; section: 'nodes' | 'workflows' }
  | { type: 'back' }
  | { type: 'nodesUnavailable'; firstMatchIndex: number }
  | {
      type: 'highlightMoved'
      direction: 1 | -1
      disabled: readonly boolean[]
    }
  | { type: 'highlighted'; index: number }
  | { type: 'closed' }

function sectionForQuery(
  state: MentionPickerState,
  trigger: QueryChangedEvent['trigger']
): MentionSection {
  if (trigger === '/') return 'skills'
  return state.status === 'open' && state.section !== 'skills'
    ? state.section
    : 'root'
}

function initialActiveIndex(
  section: MentionSection,
  query: string,
  firstMatchIndex: number
): number {
  if (query !== '' || section === 'root') return Math.max(0, firstMatchIndex)
  return section === 'skills' ? -1 : 0
}

function movedActiveIndex(
  activeIndex: number,
  direction: 1 | -1,
  disabled: readonly boolean[]
): number {
  const count = disabled.length
  const from = activeIndex < 0 && direction < 0 ? 0 : activeIndex
  for (let offset = 1; offset <= count; offset++) {
    const index = (from + direction * offset + count) % count
    if (!disabled[index]) return index
  }
  return activeIndex
}

function openForQuery(
  state: MentionPickerState,
  event: QueryChangedEvent
): OpenMentionPickerState {
  const section = sectionForQuery(state, event.trigger)
  return {
    status: 'open',
    section,
    start: event.start,
    query: event.query,
    activeIndex: initialActiveIndex(section, event.query, event.firstMatchIndex)
  }
}

export function transitionMentionPicker(
  state: MentionPickerState,
  event: MentionPickerEvent
): MentionPickerState {
  if (event.type === 'closed') return { status: 'closed' }
  if (event.type === 'queryChanged') return openForQuery(state, event)
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
    case 'highlightMoved':
      return {
        ...state,
        activeIndex: movedActiveIndex(
          state.activeIndex,
          event.direction,
          event.disabled
        )
      }
  }
}
