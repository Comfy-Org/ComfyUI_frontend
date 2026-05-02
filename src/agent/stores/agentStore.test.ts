import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { IngestedAsset } from './agentStore'
import { useAgentStore } from './agentStore'

function fakeAsset(overrides: Partial<IngestedAsset> = {}): IngestedAsset {
  return {
    id: crypto.randomUUID(),
    name: 'a.png',
    path: '/input/a.png',
    mime: 'image/png',
    size: 10,
    ...overrides
  }
}

describe('useAgentStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('starts closed with no messages', () => {
    const s = useAgentStore()
    expect(s.isOpen).toBe(false)
    expect(s.messages).toEqual([])
    expect(s.hasMessages).toBe(false)
  })

  it('toggle flips open state', () => {
    const s = useAgentStore()
    s.toggle()
    expect(s.isOpen).toBe(true)
    s.toggle()
    expect(s.isOpen).toBe(false)
  })

  it('adds message with generated id and timestamp', () => {
    const s = useAgentStore()
    const m = s.addMessage({ role: 'user', text: 'hi' })
    expect(m.id).toMatch(/[0-9a-f-]{36}/)
    expect(m.createdAt).toBeGreaterThan(0)
    expect(s.messages).toHaveLength(1)
    expect(s.hasMessages).toBe(true)
  })

  it('increments unread for assistant messages while closed', () => {
    const s = useAgentStore()
    s.addMessage({ role: 'assistant', text: 'reply' })
    expect(s.unreadCount).toBe(1)
    s.addMessage({ role: 'user', text: 'mine' })
    expect(s.unreadCount).toBe(1)
  })

  it('does not increment unread while open', () => {
    const s = useAgentStore()
    s.open()
    s.addMessage({ role: 'assistant', text: 'reply' })
    expect(s.unreadCount).toBe(0)
  })

  it('open resets unread', () => {
    const s = useAgentStore()
    s.addMessage({ role: 'assistant', text: 'reply' })
    expect(s.unreadCount).toBe(1)
    s.open()
    expect(s.unreadCount).toBe(0)
  })

  it('clearMessages empties history', () => {
    const s = useAgentStore()
    s.addMessage({ role: 'user', text: 'hi' })
    s.clearMessages()
    expect(s.messages).toEqual([])
  })

  it('pending assets add / consume / remove', () => {
    const s = useAgentStore()
    const a = fakeAsset({ id: 'a' })
    const b = fakeAsset({ id: 'b' })
    s.addPendingAsset(a)
    s.addPendingAsset(b)
    s.removePendingAsset('a')
    expect(s.pendingAssets.map((x) => x.id)).toEqual(['b'])
    const consumed = s.consumePendingAssets()
    expect(consumed.map((x) => x.id)).toEqual(['b'])
    expect(s.pendingAssets).toEqual([])
  })

  it('fabPosition persists via localStorage', async () => {
    const s = useAgentStore()
    s.fabPosition = { x: 42, y: 99 }
    await new Promise((r) => setTimeout(r, 0))
    const raw = localStorage.getItem('Comfy.Agent.FabPosition')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)).toEqual({ x: 42, y: 99 })
  })
})
