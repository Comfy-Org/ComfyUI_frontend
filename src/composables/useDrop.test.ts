import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { boxesOverlap } from '@/utils/boxesOverlap'
import { createNode } from '@/utils/litegraphUtil'
import { pasteAudioNodes, pasteImageNodes, pasteVideoNodes } from './usePaste'
import {
  handleAudioFileList,
  handleFileList,
  handleVideoFileList,
  positionBatchNodes,
  positionNodes
} from './useDrop'

vi.mock('@/utils/litegraphUtil', () => ({
  createNode: vi.fn()
}))

vi.mock('./usePaste', () => ({
  pasteAudioNodes: vi.fn(),
  pasteImageNodes: vi.fn(),
  pasteVideoNodes: vi.fn()
}))

function createMockNode(options: Record<string, unknown> = {}) {
  return {
    id: 1,
    pos: [0, 0],
    size: [200, 100],
    type: 'LoadImage',
    connect: vi.fn(),
    getBounding: vi.fn(() => new Float64Array([0, 0, 200, 100])),
    ...options
  } as unknown as LGraphNode
}

function createMockCanvas(): LGraphCanvas {
  const mockGraph: Partial<LGraph> = {
    change: vi.fn()
  }

  return {
    graph: mockGraph as LGraph,
    selectItems: vi.fn()
  } as Partial<LGraphCanvas> as LGraphCanvas
}

function createTestFile(name: string, type: string): File {
  return new File([''], name, { type })
}

describe('useDrop', () => {
  let mockCanvas: LGraphCanvas

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanvas = createMockCanvas()
  })

  describe('handleFileList', () => {
    it('should create image nodes for each file in the list', async () => {
      const mockNode1 = createMockNode({ id: 1 })
      const mockNode2 = createMockNode({ id: 2 })
      const mockBatchNode = createMockNode({ id: 3, type: 'BatchImagesNode' })

      vi.mocked(pasteImageNodes).mockResolvedValue([mockNode1, mockNode2])
      vi.mocked(createNode).mockResolvedValue(mockBatchNode)

      const file1 = createTestFile('test1.png', 'image/png')
      const file2 = createTestFile('test2.jpg', 'image/jpeg')
      const files = [file1, file2]

      await handleFileList(mockCanvas, files)

      expect(pasteImageNodes).toHaveBeenCalledWith(mockCanvas, files)
      expect(createNode).toHaveBeenCalledWith(mockCanvas, 'BatchImagesNode')
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([
        mockNode1,
        mockNode2,
        mockBatchNode
      ])
      expect(mockNode1.connect).toHaveBeenCalledWith(0, mockBatchNode, 0)
      expect(mockNode2.connect).toHaveBeenCalledWith(0, mockBatchNode, 1)
    })

    it('should select single image node without batch node', async () => {
      const mockNode1 = createMockNode({ id: 1 })
      vi.mocked(pasteImageNodes).mockResolvedValue([mockNode1])

      const file = createTestFile('test.png', 'image/png')

      await handleFileList(mockCanvas, [file])

      expect(createNode).not.toHaveBeenCalled()
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([mockNode1])
      expect(mockNode1.connect).not.toHaveBeenCalled()
    })

    it('still returns and positions the image nodes when no BatchImagesNode type is registered', async () => {
      // createNode returns null whenever the node type isn't registered
      // (e.g. no BatchImagesNode on some backends). The image nodes are
      // already on the graph at that point, so the caller must still learn
      // about them - otherwise a later batch member (e.g. an audio node)
      // never finds out they exist and can stack on top of them.
      const mockNode1 = createMockNode({ id: 1, pos: [500, 500] })
      const mockNode2 = createMockNode({ id: 2, pos: [500, 500] })

      vi.mocked(pasteImageNodes).mockResolvedValue([mockNode1, mockNode2])
      vi.mocked(createNode).mockResolvedValue(null)

      const file1 = createTestFile('test1.png', 'image/png')
      const file2 = createTestFile('test2.jpg', 'image/jpeg')

      const result = await handleFileList(mockCanvas, [file1, file2])

      expect(result).toEqual([mockNode1, mockNode2])
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([
        mockNode1,
        mockNode2
      ])
      // The two image nodes must still be spaced apart from each other.
      expect(mockNode2.pos).not.toEqual(mockNode1.pos)
    })

    it('should handle empty file list', async () => {
      await handleFileList(mockCanvas, [])

      expect(pasteImageNodes).not.toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
    })

    it('should not process unsupported file types', async () => {
      const invalidFile = createTestFile('test.pdf', 'application/pdf')

      await handleFileList(mockCanvas, [invalidFile])

      expect(pasteImageNodes).not.toHaveBeenCalled()
      expect(createNode).not.toHaveBeenCalled()
    })
  })

  describe('handleAudioFileList', () => {
    it('should create audio nodes and select them', async () => {
      const mockNode1 = createMockNode({ id: 1, type: 'LoadAudio' })
      const mockNode2 = createMockNode({ id: 2, type: 'LoadAudio' })
      vi.mocked(pasteAudioNodes).mockResolvedValue([mockNode1, mockNode2])

      const file1 = createTestFile('test1.mp3', 'audio/mpeg')
      const file2 = createTestFile('test2.wav', 'audio/wav')

      await handleAudioFileList(mockCanvas, [file1, file2])

      expect(pasteAudioNodes).toHaveBeenCalledWith(mockCanvas, [file1, file2])
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([
        mockNode1,
        mockNode2
      ])
    })

    it('should not select when no nodes created', async () => {
      vi.mocked(pasteAudioNodes).mockResolvedValue([])

      await handleAudioFileList(mockCanvas, [
        createTestFile('test.mp3', 'audio/mpeg')
      ])

      expect(mockCanvas.selectItems).not.toHaveBeenCalled()
    })
  })

  describe('handleVideoFileList', () => {
    it('should create video nodes and select them', async () => {
      const mockNode1 = createMockNode({ id: 1, type: 'LoadVideo' })
      const mockNode2 = createMockNode({ id: 2, type: 'LoadVideo' })
      vi.mocked(pasteVideoNodes).mockResolvedValue([mockNode1, mockNode2])

      const file1 = createTestFile('test1.mp4', 'video/mp4')
      const file2 = createTestFile('test2.webm', 'video/webm')

      await handleVideoFileList(mockCanvas, [file1, file2])

      expect(pasteVideoNodes).toHaveBeenCalledWith(mockCanvas, [file1, file2])
      expect(mockCanvas.selectItems).toHaveBeenCalledWith([
        mockNode1,
        mockNode2
      ])
    })

    it('should not select when no nodes created', async () => {
      vi.mocked(pasteVideoNodes).mockResolvedValue([])

      await handleVideoFileList(mockCanvas, [
        createTestFile('test.mp4', 'video/mp4')
      ])

      expect(mockCanvas.selectItems).not.toHaveBeenCalled()
    })
  })

  describe('mixed file type drag-and-drop spacing', () => {
    it('spaces an audio node dropped alongside images away from every image/batch node, not just other audio nodes', async () => {
      // FE-1482: a mixed FileList (images + audio) creates every node at the
      // same drop point. Spacing must consider ALL nodes created in the
      // batch, not just other nodes of the same type.
      const dropPos: [number, number] = [500, 500]
      // A real LoadImage does NOT report its eventual settled height
      // (~344) at positioning time - it reports something closer to this
      // pre-measurement height, before the preview image loads and the
      // node grows. If clearanceBelow trusted this raw size[1] instead of
      // going through the same height authority positionBatchNodes uses,
      // the two code paths would disagree about how much space to reserve
      // and the audio node below would end up inside the second image's
      // eventual footprint - which is exactly the bug this test guards
      // against.
      const preMeasurementImageHeight = 102
      const reservedImageHeight = 344 // must match useDrop's height authority
      const imageNode1 = createMockNode({
        id: 1,
        type: 'LoadImage',
        pos: [...dropPos],
        size: [210, preMeasurementImageHeight],
        getBounding: vi.fn(
          () => new Float64Array([...dropPos, 210, preMeasurementImageHeight])
        )
      })
      const imageNode2 = createMockNode({
        id: 2,
        type: 'LoadImage',
        pos: [...dropPos],
        size: [210, preMeasurementImageHeight]
      })
      const batchNode = createMockNode({
        id: 3,
        type: 'BatchImagesNode',
        pos: [...dropPos],
        size: [210, 100]
      })
      const audioNode = createMockNode({
        id: 4,
        type: 'LoadAudio',
        pos: [...dropPos],
        size: [210, 100],
        getBounding: vi.fn(() => new Float64Array([...dropPos, 210, 100]))
      })

      vi.mocked(pasteImageNodes).mockResolvedValue([imageNode1, imageNode2])
      vi.mocked(createNode).mockResolvedValue(batchNode)
      vi.mocked(pasteAudioNodes).mockResolvedValue([audioNode])

      const imageFiles = [
        createTestFile('a.png', 'image/png'),
        createTestFile('b.png', 'image/png')
      ]
      const audioFiles = [createTestFile('c.mp3', 'audio/mpeg')]

      const dropBatchNodes: LGraphNode[] = []
      dropBatchNodes.push(
        ...(await handleFileList(mockCanvas, imageFiles, dropBatchNodes))
      )
      dropBatchNodes.push(
        ...(await handleAudioFileList(mockCanvas, audioFiles, dropBatchNodes))
      )

      // imageNode2 is stacked under imageNode1 using the reserved slot
      // height, not imageNode1's (fake, pre-measurement) size[1].
      expect(imageNode2.pos[1]).toBe(dropPos[1] + reservedImageHeight + 50)

      // audioNode must clear the reserved slot below imageNode2, not just
      // imageNode2's pre-measurement size[1].
      expect(audioNode.pos[1]).toBeGreaterThanOrEqual(
        imageNode2.pos[1] + reservedImageHeight + 25
      )

      const allNodes = [imageNode1, imageNode2, batchNode, audioNode]
      for (let i = 0; i < allNodes.length; i++) {
        for (let j = i + 1; j < allNodes.length; j++) {
          expect(boxesOverlap(allNodes[i], allNodes[j])).toBe(false)
        }
      }
    })

    it('spaces a single image dropped after another file away from the earlier node', async () => {
      // The single-image path in handleFileList (no batch node) must also
      // respect nodes already placed earlier in the same drop batch.
      const dropPos: [number, number] = [500, 500]
      const audioNode = createMockNode({
        id: 1,
        type: 'LoadAudio',
        pos: [...dropPos],
        size: [210, 100],
        getBounding: vi.fn(() => new Float64Array([...dropPos, 210, 100]))
      })
      const imageNode = createMockNode({
        id: 2,
        type: 'LoadImage',
        pos: [...dropPos],
        size: [210, 344],
        getBounding: vi.fn(() => new Float64Array([...dropPos, 210, 344]))
      })

      vi.mocked(pasteAudioNodes).mockResolvedValue([audioNode])
      vi.mocked(pasteImageNodes).mockResolvedValue([imageNode])

      const dropBatchNodes: LGraphNode[] = []
      dropBatchNodes.push(
        ...(await handleAudioFileList(
          mockCanvas,
          [createTestFile('a.mp3', 'audio/mpeg')],
          dropBatchNodes
        ))
      )
      dropBatchNodes.push(
        ...(await handleFileList(
          mockCanvas,
          [createTestFile('b.png', 'image/png')],
          dropBatchNodes
        ))
      )

      expect(createNode).not.toHaveBeenCalled()
      expect(boxesOverlap(imageNode, audioNode)).toBe(false)
    })

    it('leaves the first node of a drop batch untouched when nothing precedes it', async () => {
      const soloNode = createMockNode({
        id: 1,
        type: 'LoadAudio',
        pos: [500, 500],
        getBounding: vi.fn(() => new Float64Array([500, 500, 210, 100]))
      })
      vi.mocked(pasteAudioNodes).mockResolvedValue([soloNode])

      await handleAudioFileList(mockCanvas, [
        createTestFile('a.mp3', 'audio/mpeg')
      ])

      expect(soloNode.pos).toEqual([500, 500])
      expect(mockCanvas.graph?.change).not.toHaveBeenCalled()
    })
  })

  describe('positionBatchNodes', () => {
    it('should position batch node to the right of first node', () => {
      const mockNode1 = createMockNode({
        pos: [100, 200],
        size: [300, 400]
      })
      const mockBatchNode = createMockNode({ pos: [0, 0] })

      positionBatchNodes(mockCanvas, [mockNode1], mockBatchNode)

      expect(mockBatchNode.pos).toEqual([500, 230])
    })

    it('should stack multiple image nodes vertically', () => {
      const mockNode1 = createMockNode({
        pos: [100, 200],
        type: 'LoadImage',
        getBounding: vi.fn(() => new Float64Array([100, 200, 300, 400]))
      })
      const mockNode2 = createMockNode({ pos: [0, 0], type: 'LoadImage' })
      const mockNode3 = createMockNode({ pos: [0, 0], type: 'LoadImage' })
      const mockBatchNode = createMockNode({ pos: [0, 0] })

      positionBatchNodes(
        mockCanvas,
        [mockNode1, mockNode2, mockNode3],
        mockBatchNode
      )

      expect(mockNode1.pos).toEqual([100, 200])
      expect(mockNode2.pos).toEqual([100, 594])
      expect(mockNode3.pos).toEqual([100, 963])
    })

    it('should call graph change once for all nodes', () => {
      const mockNode1 = createMockNode({
        getBounding: vi.fn(() => new Float64Array([100, 200, 300, 400]))
      })
      const mockBatchNode = createMockNode()

      positionBatchNodes(mockCanvas, [mockNode1], mockBatchNode)

      expect(mockCanvas.graph?.change).toHaveBeenCalledTimes(1)
    })
  })

  describe('positionNodes', () => {
    it('anchors on the node pos, not a stale/zeroed cached boundingRect', () => {
      // getBounding() returns whatever updateArea() last wrote. A node that
      // has been added to the graph but never drawn still holds
      // `new Rectangle()`, i.e. [0, 0, 0, 0] - even though its real pos is
      // wherever it was dropped. Positioning must not trust that zeroed
      // rect for the anchor.
      const nodes = [
        createMockNode({
          id: 1,
          pos: [500, 300],
          getBounding: vi.fn(() => new Float64Array([0, 0, 0, 0]))
        })
      ]

      positionNodes(mockCanvas, nodes, [
        createMockNode({ id: 2, pos: [200, 100], size: [200, 50] })
      ])

      // x must come from the node's own pos (500), never from the zeroed
      // boundingRect (which would incorrectly place it at x=0).
      expect(nodes[0].pos[0]).toBe(500)
    })

    it('spreads stacked nodes so multi-mesh drops do not overlap', () => {
      const nodes = [
        createMockNode({
          id: 1,
          pos: [100, 200],
          getBounding: vi.fn(() => new Float64Array([100, 200, 200, 100]))
        }),
        createMockNode({ id: 2, pos: [100, 200] }),
        createMockNode({ id: 3, pos: [100, 200] })
      ]

      positionNodes(mockCanvas, nodes)

      expect(nodes[0].pos).toEqual([100, 200])
      expect(nodes[1].pos).toEqual([100, 400])
      expect(nodes[2].pos).toEqual([100, 575])
    })
  })
})
