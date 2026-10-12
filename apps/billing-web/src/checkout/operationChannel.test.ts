import type { OperationNotice } from '@/checkout/operationChannel'
import {
  createOperationChannel,
  operationChannelName
} from '@/checkout/operationChannel'

/** An in-memory BroadcastChannel: every other instance on the same name hears a post. */
class FakeBroadcastChannel extends EventTarget {
  static readonly open = new Set<FakeBroadcastChannel>()
  constructor(readonly name: string) {
    super()
    FakeBroadcastChannel.open.add(this)
  }
  postMessage(data: unknown) {
    for (const other of FakeBroadcastChannel.open) {
      if (other !== this && other.name === this.name)
        other.dispatchEvent(new MessageEvent('message', { data }))
    }
  }
  close() {
    FakeBroadcastChannel.open.delete(this)
  }
}

const NOTICE: OperationNotice = {
  workspaceId: 'ws-1',
  operationId: 'op_1',
  kind: 'started'
}

const FOREIGN: readonly { name: string; value: unknown }[] = [
  { name: 'another workspace', value: { ...NOTICE, workspaceId: 'ws-2' } },
  { name: 'an unknown kind', value: { ...NOTICE, kind: 'exploded' } },
  { name: 'no operation id', value: { workspaceId: 'ws-1', kind: 'started' } },
  { name: 'a string', value: 'started' },
  { name: 'null', value: null }
]

describe('createOperationChannel over BroadcastChannel', () => {
  beforeEach(() => {
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
  })
  afterEach(() => {
    FakeBroadcastChannel.open.clear()
  })

  it("delivers a sibling tab's notice for the same user and workspace, never its own", () => {
    const publisher = createOperationChannel('uid-1', 'ws-1')
    const sibling = createOperationChannel('uid-1', 'ws-1')
    const heardByPublisher = vi.fn()
    const heardBySibling = vi.fn()
    publisher?.subscribe(heardByPublisher)
    sibling?.subscribe(heardBySibling)

    publisher?.publish(NOTICE)

    expect(heardBySibling).toHaveBeenCalledExactlyOnceWith(NOTICE)
    expect(heardByPublisher).not.toHaveBeenCalled()
  })

  it.for([
    { name: 'user', uid: 'uid-2', workspaceId: 'ws-1' },
    { name: 'workspace', uid: 'uid-1', workspaceId: 'ws-9' }
  ])('stays silent to a tab on another $name', ({ uid, workspaceId }) => {
    const publisher = createOperationChannel('uid-1', 'ws-1')
    const elsewhere = createOperationChannel(uid, workspaceId)
    const heard = vi.fn()
    elsewhere?.subscribe(heard)

    publisher?.publish(NOTICE)

    expect(heard).not.toHaveBeenCalled()
  })

  it.for(FOREIGN)('drops $name arriving on the channel', ({ value }) => {
    const sibling = createOperationChannel('uid-1', 'ws-1')
    const heard = vi.fn()
    sibling?.subscribe(heard)

    new FakeBroadcastChannel(operationChannelName('uid-1', 'ws-1')).postMessage(
      value
    )

    expect(heard).not.toHaveBeenCalled()
  })

  it('stops delivering once unsubscribed or closed', () => {
    const publisher = createOperationChannel('uid-1', 'ws-1')
    const sibling = createOperationChannel('uid-1', 'ws-1')
    const unsubscribed = vi.fn()
    const closed = vi.fn()
    sibling?.subscribe(unsubscribed)()
    const another = createOperationChannel('uid-1', 'ws-1')
    another?.subscribe(closed)
    another?.close()

    publisher?.publish(NOTICE)

    expect(unsubscribed).not.toHaveBeenCalled()
    expect(closed).not.toHaveBeenCalled()
  })
})

describe('createOperationChannel over the storage event', () => {
  beforeEach(() => {
    vi.stubGlobal('BroadcastChannel', undefined)
    localStorage.clear()
  })

  function arrive(key: string, newValue: string | null) {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue }))
  }

  it('writes a stamped notice under the scoped key, so every publish fires the event', () => {
    const channel = createOperationChannel('uid-1', 'ws-1')

    channel?.publish(NOTICE)
    const first = localStorage.getItem(operationChannelName('uid-1', 'ws-1'))
    channel?.publish(NOTICE)
    const second = localStorage.getItem(operationChannelName('uid-1', 'ws-1'))

    expect(JSON.parse(first ?? '{}')).toMatchObject(NOTICE)
    expect(first).not.toBe(second)
  })

  it('delivers a notice another tab wrote under the scoped key', () => {
    const channel = createOperationChannel('uid-1', 'ws-1')
    const heard = vi.fn()
    channel?.subscribe(heard)

    arrive(operationChannelName('uid-1', 'ws-1'), JSON.stringify(NOTICE))

    expect(heard).toHaveBeenCalledExactlyOnceWith(NOTICE)
  })

  it.for([
    {
      name: 'another key',
      key: 'comfy:billing:op:uid-1:ws-2',
      value: JSON.stringify(NOTICE)
    },
    {
      name: 'a removal',
      key: operationChannelName('uid-1', 'ws-1'),
      value: null
    },
    {
      name: 'unparseable text',
      key: operationChannelName('uid-1', 'ws-1'),
      value: '{not json'
    },
    ...FOREIGN.map(({ name, value }) => ({
      name,
      key: operationChannelName('uid-1', 'ws-1'),
      value: JSON.stringify(value)
    }))
  ])('drops $name', ({ key, value }) => {
    const channel = createOperationChannel('uid-1', 'ws-1')
    const heard = vi.fn()
    channel?.subscribe(heard)

    arrive(key, value)

    expect(heard).not.toHaveBeenCalled()
  })

  it('stops delivering once closed', () => {
    const channel = createOperationChannel('uid-1', 'ws-1')
    const heard = vi.fn()
    channel?.subscribe(heard)
    channel?.close()

    arrive(operationChannelName('uid-1', 'ws-1'), JSON.stringify(NOTICE))

    expect(heard).not.toHaveBeenCalled()
  })
})
