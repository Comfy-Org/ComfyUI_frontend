import type { Page } from '@playwright/test'

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

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []

  constructor(private page: Page) {}

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
      console.log('PERFORMANCE_METRICS:', JSON.stringify(metrics))
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
