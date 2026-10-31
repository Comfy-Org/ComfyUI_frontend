import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

import { useVideoConcatClips } from './useVideoConcatClips'

vi.mock(import('@/scripts/api'))

vi.mock(import('@/scripts/app'))

function producer(graph: LGraph, filename: string) {
  const node = new LGraphNode('LoadVideo')
  node.addOutput('VIDEO', 'VIDEO')
  graph.add(node)
  useNodeOutputStore().nodeOutputs[String(node.id)] = {
    images: [{ filename, type: 'input' }]
  }
  return node
}

function buildConcat(inputNames: string[]) {
  const graph = new LGraph()
  const concat = new LGraphNode('ConcatenateVideo')
  for (const name of inputNames) concat.addInput(name, 'VIDEO')
  graph.add(concat)
  return { graph, concat }
}

function summarize(clips: ReturnType<typeof useVideoConcatClips>['value']) {
  return clips.map(({ name, url }) => ({
    name,
    file: url && new URL(url, 'http://x').searchParams.get('filename')
  }))
}

describe('useVideoConcatClips', () => {
  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation((path) => `/api${path}`)
    useNodeOutputStore().resetAllOutputsAndPreviews()
  })

  it('lists linked inputs of the source group with their video urls', () => {
    const { graph, concat } = buildConcat([
      'videos.video0',
      'videos.video1',
      'videos.video2',
      'complete_audio'
    ])
    producer(graph, 'a.mp4').connect(0, concat, 0)
    producer(graph, 'b.mp4').connect(0, concat, 1)
    producer(graph, 'audio.mp4').connect(0, concat, 3)

    const clips = useVideoConcatClips(
      computed(() => concat),
      'videos'
    )

    expect(summarize(clips.value)).toEqual([
      { name: 'video0', file: 'a.mp4' },
      { name: 'video1', file: 'b.mp4' }
    ])
    expect(clips.value.map((clip) => clip.linkId)).toEqual(
      concat.inputs.slice(0, 2).map((_, slot) => concat.getInputLink(slot)?.id)
    )
  })

  it('updates when a link is added', () => {
    const { graph, concat } = buildConcat(['videos.video0'])
    const clips = useVideoConcatClips(
      computed(() => concat),
      'videos'
    )
    expect(clips.value).toEqual([])

    producer(graph, 'a.mp4').connect(0, concat, 0)

    expect(summarize(clips.value)).toEqual([{ name: 'video0', file: 'a.mp4' }])
  })

  it('follows a change of source group', () => {
    const { graph, concat } = buildConcat(['videos.video0', 'clips.clip0'])
    producer(graph, 'a.mp4').connect(0, concat, 0)
    producer(graph, 'b.mp4').connect(0, concat, 1)
    const source = ref('videos')
    const clips = useVideoConcatClips(
      computed(() => concat),
      source
    )

    source.value = 'clips'

    expect(summarize(clips.value)).toEqual([{ name: 'clip0', file: 'b.mp4' }])
  })

  it('falls back to the concat run preview for a source that has no video of its own', () => {
    const { graph, concat } = buildConcat(['videos.video0'])
    const create = new LGraphNode('CreateVideo')
    create.addOutput('VIDEO', 'VIDEO')
    graph.add(create)
    create.connect(0, concat, 0)
    const clips = useVideoConcatClips(
      computed(() => concat),
      'videos'
    )
    expect(summarize(clips.value)).toEqual([
      { name: 'video0', file: undefined }
    ])

    useNodeOutputStore().nodeOutputs[String(concat.id)] = {
      images: [{ filename: 'result.mp4', type: 'temp' }],
      segments: [
        {
          name: 'video0',
          filename: 'segment.mp4',
          subfolder: '',
          type: 'temp',
          source: [String(create.id), 0]
        }
      ]
    }

    expect(summarize(clips.value)).toEqual([
      { name: 'video0', file: 'segment.mp4' }
    ])
  })

  it('is empty for a node outside any graph', () => {
    const concat = new LGraphNode('ConcatenateVideo')
    concat.addInput('videos.video0', 'VIDEO')

    const clips = useVideoConcatClips(
      computed(() => concat),
      'videos'
    )

    expect(clips.value).toEqual([])
  })
})
