import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import type { ChatSession } from '@/workbench/extensions/agent/stores/agent/agentChatHistoryStore'

import { useChatHistorySearch } from './useChatHistorySearch'

function session(
  id: string,
  overrides: Partial<ChatSession> = {}
): ChatSession {
  return {
    id,
    title: `Chat ${id}`,
    updatedAt: 0,
    titleSource: 'server',
    ...overrides
  }
}

function setup(
  initial: ChatSession[],
  options: {
    currentId?: string | null
    currentTitle?: string
    workflowNames?: Record<string, string>
  } = {}
) {
  const sessions = ref(initial)
  const currentId = ref(options.currentId ?? null)
  const search = useChatHistorySearch({
    sessions: () => sessions.value,
    currentSessionId: () => currentId.value,
    currentSessionTitle: () => options.currentTitle,
    workflowNameFor: ({ workflowId }) =>
      workflowId === undefined ? undefined : options.workflowNames?.[workflowId]
  })
  return { sessions, currentId, search }
}

const ids = (search: ReturnType<typeof useChatHistorySearch>) =>
  search.results.value?.map((r) => r.session.id)

describe('useChatHistorySearch', () => {
  it('filters while typing and returns to no query when cleared', () => {
    const { search } = setup([
      session('a', { title: 'Plan the launch' }),
      session('b', { title: 'Debug sampler' })
    ])

    expect(search.results.value).toBeNull()
    search.text.value = 'plan'
    expect(ids(search)).toEqual(['a'])
    search.text.value = ''
    expect(search.results.value).toBeNull()
    expect(search.isNoResults.value).toBe(false)
  })

  it('treats whitespace-only text as no query but keeps the text', () => {
    const { search } = setup([session('a')])

    search.text.value = '   '

    expect(search.results.value).toBeNull()
    expect(search.isNoResults.value).toBe(false)
    expect(search.text.value).toBe('   ')
  })

  it('clears on first Esc, then asks to leave History on the second', () => {
    const { search } = setup([session('a', { title: 'alpha' })])
    search.text.value = 'a'

    expect(search.onEscape()).toBe('none')
    expect(search.text.value).toBe('')
    expect(search.results.value).toBeNull()
    expect(search.onEscape()).toBe('leaveHistory')
  })

  it('asks to leave History immediately on Esc with empty text', () => {
    const { search } = setup([session('a')])

    expect(search.onEscape()).toBe('leaveHistory')
  })

  it('flags no results when the query matches nothing', () => {
    const { search } = setup([session('a')])

    search.text.value = 'zzzq'

    expect(search.results.value).toEqual([])
    expect(search.isNoResults.value).toBe(true)
  })

  it('keeps results in input order', () => {
    const { search } = setup([
      session('new', { title: 'plan 2' }),
      session('old', { title: 'plan 1' })
    ])

    search.text.value = 'plan'

    expect(ids(search)).toEqual(['new', 'old'])
  })

  it('follows local renames and deletions while a query is active', () => {
    const { sessions, search } = setup([
      session('a', { title: 'Old name' }),
      session('b', { title: 'Other' })
    ])
    search.text.value = 'old'
    expect(ids(search)).toEqual(['a'])

    sessions.value = [session('a', { title: 'New name' }), session('b')]
    expect(ids(search)).toEqual([])
    search.text.value = 'new'
    expect(ids(search)).toEqual(['a'])

    sessions.value = [session('b')]
    expect(ids(search)).toEqual([])
    expect(search.isNoResults.value).toBe(true)
  })

  it('matches the title that History shows for the current chat', () => {
    const { search } = setup(
      [session('cur', { title: 'New chat', titleSource: 'fallback' })],
      { currentId: 'cur', currentTitle: 'Build a upscale flow' }
    )

    search.text.value = 'upscale'

    expect(ids(search)).toEqual(['cur'])
    search.text.value = 'new chat'
    expect(ids(search)).toEqual([])
  })

  it('shows and matches a workflow reference in the preview by its name', () => {
    const { search } = setup([
      session('a', {
        preview: 'check [Portrait flow](workflow://file%3A9)\nplease'
      })
    ])

    search.text.value = 'workflow://'
    expect(search.isNoResults.value).toBe(true)

    search.text.value = 'portrait'
    expect(search.results.value?.[0].session.preview).toBe(
      'check Portrait flow please'
    )
  })

  it('matches workflow names and tolerates unresolved ones', () => {
    const { search } = setup(
      [
        session('a', { workflowId: 'w1' }),
        session('b', { workflowId: 'missing', title: 'Mentions Portrait' }),
        session('c')
      ],
      { workflowNames: { w1: 'Portrait upscale' } }
    )

    search.text.value = 'portrait'
    expect(ids(search)).toEqual(['a', 'b'])
    expect(search.results.value?.[0].matchedFields).toEqual(['workflowName'])
    expect(search.results.value?.[1].matchedFields).toEqual(['title'])
    search.text.value = 'missing'
    expect(ids(search)).toEqual([])
  })

  it('includes a matching current chat flagged as current', () => {
    const { search } = setup(
      [session('a', { title: 'plan A' }), session('cur', { title: 'plan B' })],
      { currentId: 'cur' }
    )

    search.text.value = 'plan'

    expect(search.results.value?.map((r) => r.session.isCurrent)).toEqual([
      false,
      true
    ])
  })

  it('omits a non-matching current chat', () => {
    const { search } = setup(
      [session('a', { title: 'plan A' }), session('cur', { title: 'other' })],
      { currentId: 'cur' }
    )

    search.text.value = 'plan'

    expect(ids(search)).toEqual(['a'])
  })

  it('reset clears text and results', () => {
    const { search } = setup([session('a', { title: 'plan' })])
    search.text.value = 'plan'

    search.reset()

    expect(search.text.value).toBe('')
    expect(search.results.value).toBeNull()
    expect(search.isNoResults.value).toBe(false)
  })
})
