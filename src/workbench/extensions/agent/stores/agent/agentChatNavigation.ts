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

type HistoryView = Extract<AgentPanelView, { screen: 'history' }>

export function reduceChatNavigation(
  view: AgentPanelView,
  event: ChatNavigationEvent
): AgentPanelView {
  switch (event.type) {
    case 'listOpened':
      return idleHistory(event.threadId)
    case 'chatSelected':
      return selectChat(view, event.id, event.threadId)
    case 'selectionResolved':
      return resolveSelection(view, event.opened)
    case 'selectionInterrupted':
      return resolveSelection(view, false)
    case 'chatDeleted':
      return deleteChat(view, event.id)
    case 'conversationShown':
      return { screen: 'chat' }
  }
}

function idleHistory(previousThreadId: string | null): HistoryView {
  return { screen: 'history', previousThreadId, selection: { status: 'idle' } }
}

function selectChat(
  view: AgentPanelView,
  id: string,
  threadId: string | null
): HistoryView {
  return {
    screen: 'history',
    previousThreadId:
      view.screen === 'history' ? view.previousThreadId : threadId,
    selection: { status: 'loading', id }
  }
}

function resolveSelection(
  view: AgentPanelView,
  opened: boolean
): AgentPanelView {
  if (view.screen !== 'history' || view.selection.status !== 'loading')
    return view
  if (opened) return { screen: 'chat' }
  return { ...view, selection: { status: 'failed', id: view.selection.id } }
}

function deleteChat(view: AgentPanelView, id: string): AgentPanelView {
  if (view.screen !== 'history') return view
  const wasPrevious = view.previousThreadId === id
  const wasSelected =
    view.selection.status !== 'idle' && view.selection.id === id
  if (!wasPrevious && !wasSelected) return view
  return idleHistory(wasPrevious ? null : view.previousThreadId)
}
