import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DownloadHistoryEntry } from '@/types/templateMarketplace'

const { MockChart } = vi.hoisted(() => {
  const mockDestroyFn = vi.fn()

  class MockChartClass {
    static register = vi.fn()
    static instances: MockChartClass[] = []
    type: string
    data: unknown
    destroy = mockDestroyFn

    constructor(_canvas: unknown, config: { type: string; data: unknown }) {
      this.type = config.type
      this.data = config.data
      MockChartClass.instances.push(this)
    }
  }

  return { MockChart: MockChartClass, mockDestroyFn }
})

vi.mock('chart.js', () => ({
  Chart: MockChart,
  BarController: {},
  BarElement: {},
  CategoryScale: {},
  Filler: {},
  LineController: {},
  LineElement: {},
  LinearScale: {},
  PointElement: {},
  Tooltip: {}
}))

import DownloadHistoryChart from './DownloadHistoryChart.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      developerProfile: {
        downloadHistory: 'Download History',
        range: {
          week: 'Week',
          month: 'Month',
          year: 'Year',
          allTime: 'All Time'
        }
      }
    }
  }
})

function makeEntries(count: number): DownloadHistoryEntry[] {
  const entries: DownloadHistoryEntry[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)
    entries.push({ date, downloads: 10 + i })
  }
  return entries
}

async function mountChart(entries?: DownloadHistoryEntry[]) {
  const wrapper = mount(DownloadHistoryChart, {
    props: { entries: entries ?? makeEntries(730) },
    global: { plugins: [i18n] },
    attachTo: document.createElement('div')
  })
  await nextTick()
  await flushPromises()
  await nextTick()
  return wrapper
}

function lastInstance() {
  return MockChart.instances.at(-1)
}

describe('DownloadHistoryChart', () => {
  beforeEach(() => {
    MockChart.instances = []
  })

  it('renders all four range buttons', async () => {
    const wrapper = await mountChart()
    const buttons = wrapper.find('[data-testid="range-buttons"]')
    expect(buttons.exists()).toBe(true)
    expect(wrapper.find('[data-testid="range-btn-week"]').text()).toBe('Week')
    expect(wrapper.find('[data-testid="range-btn-month"]').text()).toBe('Month')
    expect(wrapper.find('[data-testid="range-btn-year"]').text()).toBe('Year')
    expect(wrapper.find('[data-testid="range-btn-allTime"]').text()).toBe(
      'All Time'
    )
  })

  it('defaults to week range with active styling', async () => {
    const wrapper = await mountChart()
    const weekBtn = wrapper.find('[data-testid="range-btn-week"]')
    expect(weekBtn.classes()).toContain('font-semibold')
  })

  it('creates a bar chart for week range', async () => {
    await mountChart()
    expect(lastInstance()?.type).toBe('bar')
  })

  it('switches to month and creates a bar chart', async () => {
    const wrapper = await mountChart()
    await wrapper.find('[data-testid="range-btn-month"]').trigger('click')
    await nextTick()
    await flushPromises()
    expect(lastInstance()?.type).toBe('bar')
  })

  it('switches to year and creates a line chart', async () => {
    const wrapper = await mountChart()
    await wrapper.find('[data-testid="range-btn-year"]').trigger('click')
    await nextTick()
    await flushPromises()
    expect(lastInstance()?.type).toBe('line')
  })

  it('switches to allTime and creates a line chart', async () => {
    const wrapper = await mountChart()
    await wrapper.find('[data-testid="range-btn-allTime"]').trigger('click')
    await nextTick()
    await flushPromises()
    expect(lastInstance()?.type).toBe('line')
  })

  it('destroys previous chart when switching ranges', async () => {
    const wrapper = await mountChart()
    const firstInstance = lastInstance()!

    await wrapper.find('[data-testid="range-btn-month"]').trigger('click')
    await nextTick()
    await flushPromises()

    expect(firstInstance.destroy).toHaveBeenCalled()
  })

  it('renders the heading text', async () => {
    const wrapper = await mountChart()
    expect(wrapper.text()).toContain('Download History')
  })

  it('passes 7 data points for week range', async () => {
    await mountChart()
    const chart = lastInstance()!
    const labels = (chart.data as { labels: string[] }).labels
    expect(labels).toHaveLength(7)
  })

  it('passes 31 data points for month range', async () => {
    const wrapper = await mountChart()
    await wrapper.find('[data-testid="range-btn-month"]').trigger('click')
    await nextTick()
    await flushPromises()
    const chart = lastInstance()!
    const labels = (chart.data as { labels: string[] }).labels
    expect(labels).toHaveLength(31)
  })

  it('downsamples year range to weekly buckets', async () => {
    const wrapper = await mountChart()
    await wrapper.find('[data-testid="range-btn-year"]').trigger('click')
    await nextTick()
    await flushPromises()
    const chart = lastInstance()!
    const labels = (chart.data as { labels: string[] }).labels
    // 365 days / 7 per bucket = 52 full + 1 partial = 53
    expect(labels).toHaveLength(Math.ceil(365 / 7))
  })

  it('downsamples allTime range to monthly buckets', async () => {
    const wrapper = await mountChart()
    await wrapper.find('[data-testid="range-btn-allTime"]').trigger('click')
    await nextTick()
    await flushPromises()
    const chart = lastInstance()!
    const labels = (chart.data as { labels: string[] }).labels
    // 730 days / 30 per bucket = 24 full + 1 partial = 25
    expect(labels).toHaveLength(Math.ceil(730 / 30))
  })

  it('sums downloads within each aggregated bucket', async () => {
    // 14 entries with downloads = 1 each, aggregated by 7 → 2 buckets of 7
    const entries = makeEntries(14).map((e) => ({ ...e, downloads: 1 }))
    const wrapper = mount(DownloadHistoryChart, {
      props: { entries },
      global: { plugins: [i18n] },
      attachTo: document.createElement('div')
    })
    await nextTick()
    await flushPromises()
    await nextTick()

    await wrapper.find('[data-testid="range-btn-allTime"]').trigger('click')
    await nextTick()
    await flushPromises()

    const chart = lastInstance()!
    const datasets = (chart.data as { datasets: { data: number[] }[] }).datasets
    // 14 / 30 per bucket → 1 bucket with all 14 summed
    expect(datasets[0].data).toEqual([14])
  })
})
