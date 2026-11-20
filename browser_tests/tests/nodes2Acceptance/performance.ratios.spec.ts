import { nodes2PerfFixture as test } from '@e2e/fixtures/nodes2PerfFixture'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import {
  PERF_VIEWPORT,
  WORKING_ZOOM,
  annotatePerf,
  compareRenderers,
  median
} from '@e2e/fixtures/helpers/Nodes2PerfHelper'

const GRAPH_SIZES = [
  { nodes: 200, idle: false, wholeGraphVisit: true, tags: [] },
  { nodes: 1000, idle: true, wholeGraphVisit: true, tags: [] },
  { nodes: 2000, idle: true, wholeGraphVisit: false, tags: ['@slow'] },
  { nodes: 4000, idle: true, wholeGraphVisit: false, tags: ['@slow'] }
]

const REPETITIONS = 3
const IDLE_REPETITIONS = 5
const IDLE_FRAMES = 300
const LOAD_RATIO = 1.5
const MEMORY_RATIO = 1.5
const IDLE_RATIO = 1.5
const TYPING_RATIO = 1.2
const TYPED_KEYS = 30

test.use({ viewport: PERF_VIEWPORT })

test.describe(
  'Performance acceptance: Nodes 2.0 against classic',
  { tag: ['@canvas', '@nodes2-acceptance', '@acceptance-perf'] },
  () => {
    for (const size of GRAPH_SIZES) {
      test.describe(`${size.nodes} nodes`, { tag: size.tags }, () => {
        test(`loading reaches interactive within ${LOAD_RATIO}x classic time and heap`, async ({
          nodes2Perf
        }) => {
          const samples = await nodes2Perf.interleave(REPETITIONS, (renderer) =>
            nodes2Perf.loadGraph(renderer, size.nodes)
          )
          const time = compareRenderers(samples, (s) => s.timeToInteractiveMs)
          const heap = compareRenderers(samples, (s) => s.heapMB)
          annotatePerf({ scenario: 'load', time, heap })
          expect
            .soft(time.ratio, 'time to interactive, Nodes 2.0 / classic')
            .toBeLessThanOrEqual(LOAD_RATIO)
          expect
            .soft(heap.ratio, 'heap after load, Nodes 2.0 / classic')
            .toBeLessThanOrEqual(LOAD_RATIO)
        })

        if (size.idle)
          test(`idle main-thread busy time is within ${IDLE_RATIO}x classic`, async ({
            nodes2Perf
          }) => {
            const samples = await nodes2Perf.interleave(
              IDLE_REPETITIONS,
              async (renderer) => {
                await nodes2Perf.loadGraph(renderer, size.nodes)
                await nodes2Perf.showAt(WORKING_ZOOM)
                return nodes2Perf.idleBusyPercent(IDLE_FRAMES)
              }
            )
            const busy = compareRenderers(samples, (s) => s)
            annotatePerf({ scenario: 'idle', busy })
            expect(
              busy.ratio,
              'idle busy %, Nodes 2.0 / classic'
            ).toBeLessThanOrEqual(IDLE_RATIO)
          })

        test(`typing in a prompt paints each key within ${TYPING_RATIO}x classic latency`, async ({
          nodes2Perf
        }) => {
          const samples = await nodes2Perf.interleave(
            REPETITIONS,
            async (renderer) => {
              await nodes2Perf.loadGraph(renderer, size.nodes)
              return median(await nodes2Perf.measureTyping(TYPED_KEYS))
            }
          )
          const latency = compareRenderers(samples, (s) => s)
          annotatePerf({ scenario: 'typing', latency })
          expect(
            latency.ratio,
            'median key-to-paint latency, Nodes 2.0 / classic'
          ).toBeLessThanOrEqual(TYPING_RATIO)
        })

        if (size.wholeGraphVisit)
          test(`heap after visiting the whole graph and returning is within ${MEMORY_RATIO}x classic`, async ({
            nodes2Perf
          }) => {
            const samples = await nodes2Perf.interleave(
              REPETITIONS,
              async (renderer) => {
                await nodes2Perf.loadGraph(renderer, size.nodes)
                const viewports = await nodes2Perf.visitWholeGraph()
                return { viewports, heapMB: await nodes2Perf.heapAfterGcMB() }
              }
            )
            const heap = compareRenderers(samples, (s) => s.heapMB)
            annotatePerf({
              scenario: 'visit-whole-graph',
              viewports: samples.classic[0].viewports,
              heap
            })
            expect(
              heap.ratio,
              'heap after whole-graph visit, Nodes 2.0 / classic'
            ).toBeLessThanOrEqual(MEMORY_RATIO)
          })
      })
    }
  }
)
