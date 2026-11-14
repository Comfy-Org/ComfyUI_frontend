import { describe, expect, it } from 'vitest'

import type { AgentMessages } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { createTranscriptCache } from './agentTranscriptCache'

function transcript(
  threadId: string,
  status: 'complete' | 'streaming' = 'complete'
): AgentMessages {
  return [
    {
      id: `${threadId}-user`,
      thread_id: threadId,
      seq: 1,
      role: 'user',
      status: 'complete',
      turn_id: `${threadId}-turn`,
      content: { text: `Prompt in ${threadId}` }
    },
    {
      id: `${threadId}-assistant`,
      thread_id: threadId,
      seq: 2,
      role: 'assistant',
      status,
      turn_id: `${threadId}-turn`,
      content: { text: `Answer in ${threadId}` }
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

async function fetchAndKeep(
  cache: ReturnType<typeof createTranscriptCache>,
  threadId: string,
  history = transcript(threadId)
) {
  await cache.fetch(threadId, async () => history).answer
}

describe('createTranscriptCache', () => {
  it('hands back what it fetched without fetching again', async () => {
    const cache = createTranscriptCache()
    const history = transcript('th-1')

    expect(await cache.fetch('th-1', async () => history).answer).toBe(history)

    expect(cache.recall('th-1')).toBe(history)
  })

  it('knows nothing of a chat it never fetched', () => {
    const cache = createTranscriptCache()

    expect(cache.recall('th-1')).toBeUndefined()
    expect(cache.has('th-1')).toBe(false)
  })

  it('does not keep a transcript that still has a turn running', async () => {
    const cache = createTranscriptCache()
    const running = transcript('th-1', 'streaming')

    expect(await cache.fetch('th-1', async () => running).answer).toBe(running)

    expect(cache.recall('th-1')).toBeUndefined()
  })

  it('hands back the very promise the load returned, so waiting on it adds no turn', () => {
    const cache = createTranscriptCache()
    const answer = pending<AgentMessages>()

    const read = cache.fetch('th-1', () => answer.promise)

    expect(read.answer).toBe(answer.promise)
  })

  it('drops what it keeps for a chat once something happens in that chat', async () => {
    const cache = createTranscriptCache()
    await fetchAndKeep(cache, 'th-1')
    await fetchAndKeep(cache, 'th-2')

    cache.touch('th-1')

    expect(cache.recall('th-1')).toBeUndefined()
    expect(cache.recall('th-2')).toBeDefined()
  })

  it('drops everything when something happens it cannot attribute to a chat', async () => {
    const cache = createTranscriptCache()
    await fetchAndKeep(cache, 'th-1')
    await fetchAndKeep(cache, 'th-2')

    cache.touchAll()

    expect(cache.recall('th-1')).toBeUndefined()
    expect(cache.recall('th-2')).toBeUndefined()
  })

  it('does not keep a transcript that went out of date while it was on its way', async () => {
    const cache = createTranscriptCache()
    const answer = pending<AgentMessages>()
    const fetching = cache.fetch('th-1', () => answer.promise).answer

    cache.touch('th-1')
    answer.resolve(transcript('th-1'))

    expect(await fetching).toEqual(transcript('th-1'))
    expect(cache.recall('th-1')).toBeUndefined()
  })

  it('keeps a transcript when only another chat had activity while it was on its way', async () => {
    const cache = createTranscriptCache()
    const answer = pending<AgentMessages>()
    const fetching = cache.fetch('th-1', () => answer.promise).answer

    cache.touch('th-2')
    answer.resolve(transcript('th-1'))
    await fetching

    expect(cache.recall('th-1')).toBeDefined()
  })

  it('does not keep a transcript on its way when activity could not be attributed', async () => {
    const cache = createTranscriptCache()
    const answer = pending<AgentMessages>()
    const fetching = cache.fetch('th-1', () => answer.promise).answer

    cache.touchAll()
    answer.resolve(transcript('th-1'))
    await fetching

    expect(cache.recall('th-1')).toBeUndefined()
  })

  it('keeps a transcript that was fetched after the activity it follows', async () => {
    const cache = createTranscriptCache()
    cache.touch('th-1')

    await fetchAndKeep(cache, 'th-1')

    expect(cache.recall('th-1')).toBeDefined()
  })

  it('knows whether a fetch of the chat is on its way, kept or not when it lands', async () => {
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

  it('tells a read apart that something happened after, for its own chat or for any', async () => {
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

  it('drops the kept transcript of a chat whose fetch fails, and passes the failure on', async () => {
    const cache = createTranscriptCache()
    await fetchAndKeep(cache, 'th-1')

    await expect(
      cache.fetch('th-1', async () => {
        throw new Error('offline')
      }).answer
    ).rejects.toThrow('offline')

    expect(cache.recall('th-1')).toBeUndefined()
  })

  it('keeps only the chats used most recently', async () => {
    const cache = createTranscriptCache(2)
    await fetchAndKeep(cache, 'th-1')
    await fetchAndKeep(cache, 'th-2')

    cache.recall('th-1')
    await fetchAndKeep(cache, 'th-3')

    expect(cache.has('th-1')).toBe(true)
    expect(cache.has('th-2')).toBe(false)
    expect(cache.has('th-3')).toBe(true)
  })

  it('does not count a look at the cache as a use', async () => {
    const cache = createTranscriptCache(2)
    await fetchAndKeep(cache, 'th-1')
    await fetchAndKeep(cache, 'th-2')

    cache.has('th-1')
    await fetchAndKeep(cache, 'th-3')

    expect(cache.has('th-1')).toBe(false)
    expect(cache.has('th-2')).toBe(true)
  })

  it('replaces what it kept with a newer fetch of the same chat', async () => {
    const cache = createTranscriptCache()
    await fetchAndKeep(cache, 'th-1')
    const newer = [...transcript('th-1'), ...transcript('th-1').slice(0, 1)]

    await fetchAndKeep(cache, 'th-1', newer)

    expect(cache.recall('th-1')).toBe(newer)
  })

  it('forgets everything on clear, including what is on its way', async () => {
    const cache = createTranscriptCache()
    await fetchAndKeep(cache, 'th-1')
    const answer = pending<AgentMessages>()
    const fetching = cache.fetch('th-2', () => answer.promise).answer

    cache.clear()
    answer.resolve(transcript('th-2'))
    await fetching

    expect(cache.has('th-1')).toBe(false)
    expect(cache.has('th-2')).toBe(false)
  })
})
