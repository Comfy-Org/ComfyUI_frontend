export type AgentPanelView =
  | { screen: 'chat' }
  | {
      screen: 'history'
      previousThreadId: string | null
      selection:
        | { status: 'idle' }
        | { status: 'loading' | 'failed'; id: string }
    }

export type ChatNavigationEvent =
  | { type: 'listOpened'; threadId: string | null }
  | { type: 'chatSelected'; id: string; threadId: string | null }
  | { type: 'selectionResolved'; opened: boolean }
  | { type: 'selectionInterrupted' }
  | { type: 'chatDeleted'; id: string }
  | { type: 'conversationShown' }

export function reduceChatNavigation(
  view: AgentPanelView,
  event: ChatNavigationEvent
): AgentPanelView {
  switch (event.type) {
    case 'listOpened':
      return {
        screen: 'history',
        previousThreadId: event.threadId,
        selection: { status: 'idle' }
      }
    case 'chatSelected':
      return {
        screen: 'history',
        previousThreadId:
          view.screen === 'history' ? view.previousThreadId : event.threadId,
        selection: { status: 'loading', id: event.id }
      }
    case 'selectionResolved':
      if (view.screen !== 'history' || view.selection.status !== 'loading')
        return view
      return event.opened
        ? { screen: 'chat' }
        : { ...view, selection: { status: 'failed', id: view.selection.id } }
    case 'selectionInterrupted':
      if (view.screen !== 'history' || view.selection.status !== 'loading')
        return view
      return {
        ...view,
        selection: { status: 'failed', id: view.selection.id }
      }
    case 'chatDeleted': {
      if (view.screen !== 'history') return view
      const wasPrevious = view.previousThreadId === event.id
      const wasSelected =
        view.selection.status !== 'idle' && view.selection.id === event.id
      if (!wasPrevious && !wasSelected) return view
      return {
        screen: 'history',
        previousThreadId: wasPrevious ? null : view.previousThreadId,
        selection: { status: 'idle' }
      }
    }
    case 'conversationShown':
      return { screen: 'chat' }
  }
}
