import type { Page, TestInfo } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

export interface PerformanceMetrics {
  testName: string
  timestamp: number
  branch?: string
  memoryUsage: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  } | null
  timing: {
    loadStart?: number
    domContentLoaded?: number
    loadComplete?: number
    firstPaint?: number
    firstContentfulPaint?: number
    largestContentfulPaint?: number
  }
  customMetrics: Record<string, number>
}

export interface PerformanceRunSummary {
  runId: string
  timestamp: number
  branch: string
  gitCommit?: string
  environment: {
    nodeVersion: string
    playwrightVersion: string
    os: string
  }
  testMetrics: PerformanceMetrics[]
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private static allMetrics: PerformanceMetrics[] = []

  constructor(
    private page: Page,
    private testInfo?: TestInfo
  ) {}

  async startMonitoring(testName: string) {
    await this.page.evaluate((testName) => {
      // Initialize performance monitoring
      window.perfMonitor = {
        testName,
        startTime: performance.now(),
        marks: new Map(),
        measures: new Map()
      }

      // Mark test start
      performance.mark(`${testName}-start`)

      // Set up performance observer to capture paint metrics
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (
              entry.entryType === 'paint' ||
              entry.entryType === 'largest-contentful-paint'
            ) {
              window.perfMonitor?.measures.set(entry.name, entry.startTime)
            }
          }
        })
        observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] })
      }
    }, testName)
  }

  async markEvent(eventName: string) {
    await this.page.evaluate((eventName) => {
      if (window.perfMonitor) {
        const markName = `${window.perfMonitor.testName}-${eventName}`
        performance.mark(markName)
        window.perfMonitor.marks.set(
          eventName,
          performance.now() - window.perfMonitor.startTime
        )
      }
    }, eventName)
  }

  async measureOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    await this.markEvent(`${operationName}-start`)
    const result = await operation()
    await this.markEvent(`${operationName}-end`)

    // Create performance measure
    await this.page.evaluate((operationName) => {
      if (window.perfMonitor) {
        const testName = window.perfMonitor.testName
        const startMark = `${testName}-${operationName}-start`
        const endMark = `${testName}-${operationName}-end`

        try {
          performance.measure(`${operationName}`, startMark, endMark)
          const measure = performance.getEntriesByName(`${operationName}`)[0]
          window.perfMonitor.measures.set(operationName, measure.duration)
        } catch (e) {
          console.warn('Failed to create performance measure:', e)
        }
      }
    }, operationName)

    return result
  }

  async collectMetrics(
    testName: string,
    branch: string = 'unknown'
  ): Promise<PerformanceMetrics | null> {
    const metrics = await this.page.evaluate(
      ({ testName, branch }) => {
        if (!window.perfMonitor) return null

        // Collect all performance data
        const navigationEntry = performance.getEntriesByType(
          'navigation'
        )[0] as PerformanceNavigationTiming
        const paintEntries = performance.getEntriesByType('paint')
        const lcpEntries = performance.getEntriesByType(
          'largest-contentful-paint'
        )

        const timing: any = {}
        if (navigationEntry) {
          timing.loadStart = navigationEntry.loadEventStart
          timing.domContentLoaded = navigationEntry.domContentLoadedEventEnd
          timing.loadComplete = navigationEntry.loadEventEnd
        }

        paintEntries.forEach((entry) => {
          if (entry.name === 'first-paint') {
            timing.firstPaint = entry.startTime
          } else if (entry.name === 'first-contentful-paint') {
            timing.firstContentfulPaint = entry.startTime
          }
        })

        if (lcpEntries.length > 0) {
          timing.largestContentfulPaint =
            lcpEntries[lcpEntries.length - 1].startTime
        }

        const customMetrics: Record<string, number> = {}
        window.perfMonitor.measures.forEach((value, key) => {
          customMetrics[key] = value
        })

        return {
          testName,
          timestamp: Date.now(),
          branch,
          memoryUsage: performance.memory
            ? {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
              }
            : null,
          timing,
          customMetrics
        }
      },
      { testName, branch }
    )

    if (metrics) {
      this.metrics.push(metrics)
      PerformanceMonitor.allMetrics.push(metrics)

      // Write individual metric file immediately for worker persistence
      try {
        const tempDir = path.join(process.cwd(), 'test-results', '.perf-temp')
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true })
        }
        const tempFile = path.join(
          tempDir,
          `metric-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`
        )
        fs.writeFileSync(tempFile, JSON.stringify(metrics, null, 2))
      } catch (error) {
        console.warn('Failed to write temp metric file:', error)
      }

      console.log('PERFORMANCE_METRICS:', JSON.stringify(metrics))
      console.log(
        `📈 Total metrics collected so far: ${PerformanceMonitor.allMetrics.length}`
      )
    }

    return metrics
  }

  async finishMonitoring(testName: string) {
    await this.markEvent('test-end')
    await this.collectMetrics(testName, 'vue-widget/perf-test')
    console.log('Finishing performance monitoring')
    // Print all metrics
    console.log('PERFORMANCE_METRICS:', JSON.stringify(this.metrics))

    // Cleanup
    await this.page.evaluate(() => {
      if (window.perfMonitor) {
        delete window.perfMonitor
      }
    })
  }

  getAllMetrics(): PerformanceMetrics[] {
    return this.metrics
  }

  static getAllCollectedMetrics(): PerformanceMetrics[] {
    return PerformanceMonitor.allMetrics
  }

  static clearAllMetrics() {
    PerformanceMonitor.allMetrics = []
  }

  static async saveMetricsToFile(outputPath?: string): Promise<string> {
    // This runs in Node.js context (global teardown), not browser
    if (typeof window !== 'undefined') {
      throw new Error(
        'saveMetricsToFile should only be called from Node.js context'
      )
    }

    // Collect metrics from temp files (handles worker persistence)
    const allMetrics: PerformanceMetrics[] = []
    const tempDir = path.join(process.cwd(), 'test-results', '.perf-temp')

    if (fs.existsSync(tempDir)) {
      const tempFiles = fs
        .readdirSync(tempDir)
        .filter((f) => f.startsWith('metric-') && f.endsWith('.json'))
      for (const file of tempFiles) {
        try {
          const content = fs.readFileSync(path.join(tempDir, file), 'utf8')
          const metric = JSON.parse(content)
          allMetrics.push(metric)
        } catch (error) {
          console.warn(`Failed to read temp metric file ${file}:`, error)
        }
      }

      // Clean up temp files
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (error) {
        console.warn('Failed to clean up temp directory:', error)
      }
    }

    // Also include any metrics from static array (fallback)
    allMetrics.push(...PerformanceMonitor.allMetrics)

    const defaultPath = path.join(process.cwd(), 'test-results', 'performance')
    const resultsDir = outputPath || defaultPath

    // Ensure directory exists
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true })
    }

    const runId = `run-${new Date().toISOString().replace(/[:.]/g, '-')}`
    const branch =
      process.env.GIT_BRANCH ||
      process.env.GITHUB_HEAD_REF ||
      process.env.GITHUB_REF_NAME ||
      'unknown'

    // Get Playwright version more safely
    let playwrightVersion = 'unknown'
    try {
      playwrightVersion = require('@playwright/test/package.json').version
    } catch {
      // Fallback if package.json not accessible
      playwrightVersion = 'unknown'
    }

    const summary: PerformanceRunSummary = {
      runId,
      timestamp: Date.now(),
      branch,
      gitCommit: process.env.GITHUB_SHA || process.env.GIT_COMMIT,
      environment: {
        nodeVersion: process.version,
        playwrightVersion,
        os: process.platform
      },
      testMetrics: allMetrics
    }

    const fileName = `${runId}.json`
    const filePath = path.join(resultsDir, fileName)

    try {
      fs.writeFileSync(filePath, JSON.stringify(summary, null, 2))
      console.log(`\n📊 Performance metrics saved to: ${filePath}`)
      console.log(`📈 Total tests measured: ${allMetrics.length}`)

      // Also create/update a latest.json for easy access
      const latestPath = path.join(resultsDir, 'latest.json')
      fs.writeFileSync(latestPath, JSON.stringify(summary, null, 2))

      return filePath
    } catch (error) {
      console.error('Failed to save performance metrics:', error)
      throw error
    }
  }
}

// Extend window type for TypeScript
declare global {
  interface Window {
    perfMonitor?: {
      testName: string
      startTime: number
      marks: Map<string, number>
      measures: Map<string, number>
    }
  }

  // Chrome-specific performance.memory extension
  interface Performance {
    memory?: {
      usedJSHeapSize: number
      totalJSHeapSize: number
      jsHeapSizeLimit: number
    }
  }
}
