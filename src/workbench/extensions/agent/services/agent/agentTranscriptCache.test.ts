import { describe, expect, it } from 'vitest'

import type { AgentMessages } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { createTranscriptCache } from './agentTranscriptCache'

function transcript(threadId: string): AgentMessages {
  return [
    {
      id: `${threadId}-user`,
      thread_id: threadId,
      seq: 1,
      role: 'user',
      status: 'complete',
      turn_id: `${threadId}-turn`,
      content: { text: `Prompt in ${threadId}` }
    }
  ] satisfies AgentMessages
}

function pending<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('createTranscriptCache', () => {
  it('delivers the loaded transcript to callers without adding an extra microtask turn', async () => {
    const cache = createTranscriptCache()
    const answer = pending<AgentMessages>()
    const rows = transcript('th-1')

    const read = cache.fetch('th-1', () => answer.promise)
    const order: string[] = []
    const delivered = read.answer.then((value) => {
      order.push('cache-caller')
      return value
    })
    const direct = answer.promise.then(() => {
      order.push('direct-caller')
    })

    answer.resolve(rows)
    const [result] = await Promise.all([delivered, direct])

    expect(result).toEqual(rows)
    expect(order).toEqual(['cache-caller', 'direct-caller'])
  })

  it('knows whether a fetch of the chat is on its way', async () => {
    const cache = createTranscriptCache()
    const answer = pending<AgentMessages>()
    const fetching = cache.fetch('th-1', () => answer.promise).answer

    expect(cache.isFetching('th-1')).toBe(true)
    expect(cache.isFetching('th-2')).toBe(false)

    cache.touch('th-1')
    expect(cache.isFetching('th-1')).toBe(true)

    answer.resolve(transcript('th-1'))
    await fetching
    expect(cache.isFetching('th-1')).toBe(false)
  })

  it('tells a read apart that something happened after, for its own chat or for any', () => {
    const cache = createTranscriptCache()
    const answer = pending<AgentMessages>()
    const read = cache.fetch('th-1', () => answer.promise)
    const other = cache.fetch('th-2', () => answer.promise)

    expect(read.isOutdated()).toBe(false)
    cache.touch('th-2')
    expect(read.isOutdated()).toBe(false)
    expect(other.isOutdated()).toBe(true)

    cache.touchAll()
    expect(read.isOutdated()).toBe(true)
  })

  it('does not call a read outdated for activity that came before it began', () => {
    const cache = createTranscriptCache()
    cache.touch('th-1')
    cache.touchAll()

    const read = cache.fetch('th-1', () => pending<AgentMessages>().promise)

    expect(read.isOutdated()).toBe(false)
  })

  it('marks in-flight reads outdated on touchAll and drops them once settled', async () => {
    const cache = createTranscriptCache()
    const answer = pending<AgentMessages>()
    const read = cache.fetch('th-2', () => answer.promise)

    cache.touchAll()
    expect(read.isOutdated()).toBe(true)

    answer.resolve(transcript('th-2'))
    await read.answer
    expect(cache.isFetching('th-2')).toBe(false)
  })
})
