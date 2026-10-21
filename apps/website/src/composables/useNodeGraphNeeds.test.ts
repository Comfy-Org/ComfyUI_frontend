import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { createSSRApp, defineComponent, h, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

import type { NodeGraphNeeds } from './useNodeGraphNeeds'
import { useNodeGraphNeeds } from './useNodeGraphNeeds'

const imageGraph = { nodes: [{ type: 'LoadImage' }] }
const audioGraph = { nodes: [{ type: 'LoadAudio' }] }

type PendingRead = {
  url: string
  signal: AbortSignal
  respond: (response: Response) => void
}

function deferFetch({ honourAbort = true } = {}) {
  const reads: PendingRead[] = []
  vi.mocked(fetch).mockImplementation((input, init) => {
    const signal = init?.signal
    if (!signal) throw new Error('read without a signal')
    return new Promise<Response>((resolve, reject) => {
      if (honourAbort)
        signal.addEventListener('abort', () => reject(signal.reason))
      reads.push({ url: String(input), signal, respond: resolve })
    })
  })
  return reads
}

function harness(source: Ref<string | undefined>) {
  let needs: Ref<NodeGraphNeeds> | undefined
  const view = render(
    defineComponent({
      setup() {
        needs = useNodeGraphNeeds(source)
        return () => h('div')
      }
    })
  )
  if (!needs) throw new Error('harness did not run setup')
  return { needs, unmount: view.unmount }
}

function statusOf(needs: NodeGraphNeeds) {
  return needs.status === 'read'
    ? needs.inputs.map(({ media }) => media)
    : needs.status
}

describe('useNodeGraphNeeds', () => {
  it('does not read the graph while rendering on the server', async () => {
    let needs: Ref<NodeGraphNeeds> | undefined
    const app = createSSRApp(
      defineComponent({
        setup() {
          needs = useNodeGraphNeeds('/graph.json')
          return () => h('div')
        }
      })
    )

    await renderToString(app)

    expect(fetch).not.toHaveBeenCalled()
    expect(needs?.value.status).toBe('loading')
  })

  it('reads the inputs once mounted', async () => {
    const reads = deferFetch()
    const { needs } = harness(ref('/graph.json'))
    await nextTick()

    expect(statusOf(needs.value)).toBe('loading')
    reads[0].respond(Response.json(imageGraph))

    await vi.waitFor(() => expect(statusOf(needs.value)).toEqual(['image']))
  })

  it('reports a failed read for an error status even with a JSON body', async () => {
    const reads = deferFetch()
    const { needs } = harness(ref('/graph.json'))
    await nextTick()

    reads[0].respond(Response.json(imageGraph, { status: 500 }))

    await vi.waitFor(() => expect(needs.value.status).toBe('failed'))
  })

  it('gives up on a read that takes too long', async () => {
    const timer = new AbortController()
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timer.signal)
    const reads = deferFetch()
    const { needs } = harness(ref('/graph.json'))
    await nextTick()

    expect(timeout).toHaveBeenCalledWith(15_000)
    expect(needs.value.status).toBe('loading')
    timer.abort(new DOMException('timed out', 'TimeoutError'))

    expect(reads[0].signal.aborted).toBe(true)
    await vi.waitFor(() => expect(needs.value.status).toBe('failed'))
  })

  it('cancels the old read and ignores it when the source changes', async () => {
    const reads = deferFetch({ honourAbort: false })
    const source = ref('/v1.json')
    const { needs } = harness(source)
    await nextTick()

    source.value = '/v2.json'
    await nextTick()
    reads[1].respond(Response.json(audioGraph))
    await vi.waitFor(() => expect(statusOf(needs.value)).toEqual(['audio']))
    reads[0].respond(Response.json(imageGraph))
    await new Promise((resolve) => setTimeout(resolve))

    expect(reads.map(({ url }) => url)).toEqual(['/v1.json', '/v2.json'])
    expect(reads[0].signal.aborted).toBe(true)
    expect(statusOf(needs.value)).toEqual(['audio'])
  })

  it('cancels the read when the page unmounts', async () => {
    const reads = deferFetch()
    const { unmount } = harness(ref('/graph.json'))
    await nextTick()

    unmount()

    expect(reads[0].signal.aborted).toBe(true)
  })

  it('needs nothing when there is no graph to read', async () => {
    const { needs } = harness(ref(undefined))
    await nextTick()

    expect(fetch).not.toHaveBeenCalled()
    expect(statusOf(needs.value)).toEqual([])
  })
})
