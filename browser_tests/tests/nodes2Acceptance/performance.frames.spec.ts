import { nodes2PerfFixture as test } from '@e2e/fixtures/nodes2PerfFixture'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import {
  PERF_RENDERERS,
  PERF_VIEWPORT,
  WORKING_ZOOM,
  annotatePerf
} from '@e2e/fixtures/helpers/Nodes2PerfHelper'
import { gestureFrameStats } from '@e2e/fixtures/utils/nodes2PerfStats'

const GRAPH_SIZES = [
  { nodes: 200, panOnly: false },
  { nodes: 1000, panOnly: true }
]

const FRAME_P95_MS = 33
const ZOOM_WORST_FRAME_MS = 50

test.use({ viewport: PERF_VIEWPORT })

for (const renderer of PERF_RENDERERS) {
  test.describe(
    `Performance acceptance: ${renderer.name}`,
    {
      tag: [
        '@canvas',
        '@nodes2-acceptance',
        '@acceptance-perf',
        ...(renderer.vueNodes ? ['@vue-nodes'] : [])
      ]
    },
    () => {
      for (const size of GRAPH_SIZES) {
        test.describe(`${size.nodes} nodes`, () => {
          test.beforeEach(async ({ nodes2Perf }) => {
            await nodes2Perf.prepare(renderer)
            annotatePerf({
              load: await nodes2Perf.loadGraph(renderer, size.nodes)
            })
          })

          test(`panning at working zoom keeps p95 frame time within ${FRAME_P95_MS} ms`, async ({
            nodes2Perf
          }) => {
            await nodes2Perf.showAt(WORKING_ZOOM)
            const stats = gestureFrameStats(
              await nodes2Perf.measurePan(0.8, 90)
            )
            annotatePerf({ scenario: 'pan-working', ...stats })
            expect(stats.p95, 'pan p95 frame time in ms').toBeLessThanOrEqual(
              FRAME_P95_MS
            )
          })

          if (size.panOnly) return

          test(`dragging one node at working zoom keeps p95 frame time within ${FRAME_P95_MS} ms`, async ({
            nodes2Perf
          }) => {
            const node = await nodes2Perf.centralNode('KSampler')
            await nodes2Perf.showAt(WORKING_ZOOM, { x: node.x, y: node.y })
            const stats = gestureFrameStats(
              await nodes2Perf.measureDrag(node.id, [node.id])
            )
            annotatePerf({ scenario: 'drag-one-working', ...stats })
            expect(stats.p95, 'drag p95 frame time in ms').toBeLessThanOrEqual(
              FRAME_P95_MS
            )
          })

          test(`dragging 50 selected nodes at working zoom keeps p95 frame time within ${FRAME_P95_MS} ms`, async ({
            nodes2Perf
          }) => {
            const node = await nodes2Perf.centralNode('KSampler')
            await nodes2Perf.showAt(WORKING_ZOOM, { x: node.x, y: node.y })
            const selected = await nodes2Perf.selectNearest(node.id, 50)
            const stats = gestureFrameStats(
              await nodes2Perf.measureDrag(node.id, selected)
            )
            annotatePerf({ scenario: 'drag-50-working', ...stats })
            expect(stats.p95, 'drag p95 frame time in ms').toBeLessThanOrEqual(
              FRAME_P95_MS
            )
          })

          test(`panning with the whole graph in view keeps p95 frame time within ${FRAME_P95_MS} ms`, async ({
            nodes2Perf
          }) => {
            await nodes2Perf.showWholeGraph()
            const stats = gestureFrameStats(
              await nodes2Perf.measurePan(0.2, 40)
            )
            annotatePerf({ scenario: 'pan-fit', ...stats })
            expect(stats.p95, 'pan p95 frame time in ms').toBeLessThanOrEqual(
              FRAME_P95_MS
            )
          })

          test(`a zoom sweep across the low-quality threshold has no frame over ${ZOOM_WORST_FRAME_MS} ms`, async ({
            nodes2Perf
          }) => {
            const sample = await nodes2Perf.measureZoomSweep()
            const worst = Math.max(...sample.intervals)
            annotatePerf({
              scenario: 'zoom-sweep',
              worst,
              ...gestureFrameStats(sample)
            })
            expect(worst, 'worst zoom frame time in ms').toBeLessThanOrEqual(
              ZOOM_WORST_FRAME_MS
            )
          })

          test(`dragging one node with the whole graph in view keeps p95 frame time within ${FRAME_P95_MS} ms`, async ({
            nodes2Perf
          }) => {
            const node = await nodes2Perf.centralNode('KSampler')
            await nodes2Perf.showWholeGraph()
            const stats = gestureFrameStats(
              await nodes2Perf.measureDrag(node.id, [node.id])
            )
            annotatePerf({ scenario: 'drag-one-fit', ...stats })
            expect(stats.p95, 'drag p95 frame time in ms').toBeLessThanOrEqual(
              FRAME_P95_MS
            )
          })

          test(`dragging 50 selected nodes with the whole graph in view keeps p95 frame time within ${FRAME_P95_MS} ms`, async ({
            nodes2Perf
          }) => {
            const node = await nodes2Perf.centralNode('KSampler')
            await nodes2Perf.showWholeGraph()
            const selected = await nodes2Perf.selectNearest(node.id, 50)
            const stats = gestureFrameStats(
              await nodes2Perf.measureDrag(node.id, selected)
            )
            annotatePerf({ scenario: 'drag-50-fit', ...stats })
            expect(stats.p95, 'drag p95 frame time in ms').toBeLessThanOrEqual(
              FRAME_P95_MS
            )
          })
        })
      }
    }
  )
}
