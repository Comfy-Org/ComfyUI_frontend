import type { Metric } from 'web-vitals'

type ReportHandler = (metric: Metric) => void

const isDev = import.meta.env.DEV

function sendToAnalytics(metric: Metric): void {
  if (isDev) {
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: metric.value,
      rating: metric.rating,
      id: metric.id
    })
    return
  }

  if (typeof window !== 'undefined' && 'sendBeacon' in navigator) {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      navigationType: metric.navigationType,
      delta: metric.delta
    })
    navigator.sendBeacon('/api/vitals', body)
  }
}

export async function reportWebVitals(
  onReport: ReportHandler = sendToAnalytics
): Promise<void> {
  if (typeof window === 'undefined') return

  const { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } =
    await import('web-vitals')

  onCLS(onReport)
  onFCP(onReport)
  onFID(onReport)
  onINP(onReport)
  onLCP(onReport)
  onTTFB(onReport)
}

if (typeof window !== 'undefined') {
  reportWebVitals()
}
