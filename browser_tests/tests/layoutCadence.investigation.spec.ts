import { appendFile, writeFile } from 'node:fs/promises'

import { mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

type Metric = { name: string; value: number }

test.describe('Layout cadence investigation', { tag: ['@perf'] }, () => {
  test('controlled cell', async ({ comfyPage, getWebSocket }) => {
    const arm = process.env.LAYOUT_ARM ?? 'none'
    const vueNodes = process.env.LAYOUT_VUE === '1'
    const minimap = process.env.LAYOUT_MINIMAP === '1'
    const hideWidgets = process.env.LAYOUT_HIDE_WIDGETS === '1'
    const disableAnimations = process.env.LAYOUT_DISABLE_ANIMATIONS === '1'
    const disableProgressTransition =
      process.env.LAYOUT_DISABLE_PROGRESS_TRANSITION === '1'
    const durationMs = Number(process.env.LAYOUT_DURATION_MS ?? 3000)
    const tracePath = process.env.LAYOUT_TRACE_PATH

    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', vueNodes)
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', minimap)
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')
    if (vueNodes) await comfyPage.vueNodes.waitForNodes()
    await comfyPage.idleFrames(30)

    if (hideWidgets) {
      await comfyPage.page.addStyleTag({
        content:
          '.dom-widget, .comfy-dom-widget, [data-dom-widget], [data-testid*="widget"] { display: none !important; }'
      })
    }
    if (disableAnimations) {
      await comfyPage.page.addStyleTag({
        content:
          '*, *::before, *::after { animation: none !important; transition: none !important; }'
      })
      await comfyPage.page.evaluate(() => {
        for (const animation of document.getAnimations()) animation.cancel()
      })
    }
    if (disableProgressTransition) {
      await comfyPage.page.addStyleTag({
        content:
          '.transition-\\[width\\] { transition-property: none !important; }'
      })
    }

    const cdp = await comfyPage.page.context().newCDPSession(comfyPage.page)
    await cdp.send('Performance.enable', { timeDomain: 'timeTicks' })
    const snapshot = async () => {
      const result = (await cdp.send('Performance.getMetrics')) as {
        metrics: Metric[]
      }
      return Object.fromEntries(
        result.metrics.map(({ name, value }) => [name, value])
      )
    }

    await comfyPage.page.evaluate(() => {
      const state = {
        mutations: 0,
        attributes: {} as Record<string, number>,
        targets: {} as Record<string, number>,
        rafs: 0,
        rafTimestamps: [] as number[],
        timerTicks: 0,
        active: true
      }
      const observer = new MutationObserver((records) => {
        state.mutations += records.length
        for (const record of records) {
          const attr = record.attributeName ?? record.type
          state.attributes[attr] = (state.attributes[attr] ?? 0) + 1
          const el = record.target as Element
          const key = `${el.tagName || 'node'}${el.id ? `#${el.id}` : ''}${el.classList?.length ? `.${[...el.classList].slice(0, 3).join('.')}` : ''}`
          state.targets[key] = (state.targets[key] ?? 0) + 1
        }
      })
      observer.observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true
      })
      const tick = (timestamp: number) => {
        if (!state.active) return
        state.rafs++
        state.rafTimestamps.push(timestamp)
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      ;(window as unknown as Record<string, unknown>).__layoutCadence = {
        state,
        observer
      }
    })

    const before = await snapshot()
    if (tracePath) {
      await cdp.send('Tracing.start', {
        categories:
          'devtools.timeline,blink,disabled-by-default-devtools.timeline.invalidationTracking',
        options: 'sampling-frequency=1000',
        transferMode: 'ReturnAsStream'
      })
    }
    let timer: NodeJS.Timeout | undefined
    if (arm === 'timer') {
      timer = setInterval(() => {
        void comfyPage.page.evaluate(() => {
          const holder = (window as unknown as Record<string, unknown>)
            .__layoutCadence as { state: { timerTicks: number } }
          holder.state.timerTicks++
        })
      }, 100)
    } else if (arm === 'progress') {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())
      const jobId = await execution.run()
      const nodeId = await comfyPage.page.evaluate(() =>
        String(window.app?.graph.nodes[0]?.id)
      )
      execution.executionStart(jobId)
      execution.executing(jobId, nodeId)
      timer = setInterval(() => {
        const step = Math.floor(performance.now() / 100) % 100
        execution.progress(jobId, nodeId, step, 100)
      }, 100)
    }

    await comfyPage.page.waitForTimeout(durationMs)
    if (timer) clearInterval(timer)
    if (tracePath) {
      const complete = new Promise<{ stream?: string }>((resolve) => {
        cdp.once('Tracing.tracingComplete', resolve)
      })
      await cdp.send('Tracing.end')
      const { stream } = await complete
      if (!stream) throw new Error('Trace stream was not returned')
      let trace = ''
      while (true) {
        const chunk = (await cdp.send('IO.read', { handle: stream })) as {
          data: string
          eof?: boolean
        }
        trace += chunk.data
        if (trace.length > 32 * 1024 * 1024)
          throw new Error('Bounded trace exceeded 32 MiB')
        if (chunk.eof) break
      }
      await cdp.send('IO.close', { handle: stream })
      await writeFile(tracePath, trace)
    }
    const after = await snapshot()
    const dom = await comfyPage.page.evaluate(() => {
      const holder = (window as unknown as Record<string, unknown>)
        .__layoutCadence as {
        state: {
          mutations: number
          attributes: Record<string, number>
          targets: Record<string, number>
          rafs: number
          rafTimestamps: number[]
          timerTicks: number
          active: boolean
        }
        observer: MutationObserver
      }
      holder.state.active = false
      holder.observer.disconnect()
      const intervals = holder.state.rafTimestamps
        .slice(1)
        .map((timestamp, index) => timestamp - holder.state.rafTimestamps[index])
      const sortedIntervals = [...intervals].sort((a, b) => a - b)
      const percentile = (fraction: number) =>
        sortedIntervals[
          Math.min(
            sortedIntervals.length - 1,
            Math.max(0, Math.ceil(sortedIntervals.length * fraction) - 1)
          )
        ] ?? 0
      return {
        ...holder.state,
        rafTimestamps: undefined,
        rafIntervals: {
          count: intervals.length,
          p50Ms: percentile(0.5),
          p95Ms: percentile(0.95),
          p99Ms: percentile(0.99),
          maxMs: sortedIntervals.at(-1) ?? 0,
          over16_67: intervals.filter((value) => value > 16.67).length,
          over33_3: intervals.filter((value) => value > 33.3).length,
          over50: intervals.filter((value) => value > 50).length
        },
        targets: Object.fromEntries(
          Object.entries(holder.state.targets)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
        ),
        animations: document.getAnimations().map((animation) => {
          const effect = animation.effect as KeyframeEffect | null
          const target = effect?.target as Element | null
          return {
            playState: animation.playState,
            currentTime: animation.currentTime,
            target: target
              ? `${target.tagName}${target.id ? `#${target.id}` : ''}${target.classList.length ? `.${[...target.classList].slice(0, 5).join('.')}` : ''}`
              : null,
            keyframes: effect?.getKeyframes().map((frame) => ({
              offset: frame.offset,
              transform: frame.transform,
              opacity: frame.opacity,
              width: frame.width
            }))
          }
        }),
        domNodes: document.getElementsByTagName('*').length
      }
    })
    await cdp.send('Performance.disable')
    await cdp.detach()

    const delta = (name: string, scale = 1) =>
      ((after[name] ?? 0) - (before[name] ?? 0)) * scale
    const result = {
        sha: process.env.PERF_GIT_SHA,
        arm,
        vueNodes,
        minimap,
        hideWidgets,
        disableAnimations,
        disableProgressTransition,
        durationMs: delta('Timestamp', 1000),
        styleRecalcs: delta('RecalcStyleCount'),
        styleRecalcMs: delta('RecalcStyleDuration', 1000),
        layouts: delta('LayoutCount'),
        layoutMs: delta('LayoutDuration', 1000),
        taskMs: delta('TaskDuration', 1000),
        scriptMs: delta('ScriptDuration', 1000),
        dom
      }
    const encodedResult = JSON.stringify(result)
    if (process.env.PROOF_RESULTS_PATH) {
      await appendFile(process.env.PROOF_RESULTS_PATH, `${encodedResult}\n`)
    }
    console.log(`LAYOUT_CADENCE_RESULT ${encodedResult}`)
  })
})
