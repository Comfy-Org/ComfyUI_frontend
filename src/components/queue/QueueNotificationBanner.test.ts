import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import QueueNotificationBanner from '@/components/queue/QueueNotificationBanner.vue'
import type { QueueNotificationBanner as QueueNotificationBannerItem } from '@/composables/queue/useQueueNotificationBanners'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      queue: {
        jobAddedToQueue: 'Job added to queue',
        jobQueueing: 'Job queueing'
      },
      sideToolbar: {
        queueProgressOverlay: {
          preview: 'Preview',
          jobCompleted: 'Job completed',
          jobFailed: 'Job failed',
          jobsAddedToQueue:
            '{count} job added to queue | {count} jobs added to queue',
          jobsCompleted: '{count} job completed | {count} jobs completed',
          jobsFailed: '{count} job failed | {count} jobs failed'
        }
      }
    }
  }
})

function renderComponent(notification: QueueNotificationBannerItem) {
  return render(QueueNotificationBanner, {
    props: { notification },
    global: {
      plugins: [i18n]
    }
  })
}

describe(QueueNotificationBanner, () => {
  it('renders singular queued message without count prefix', () => {
    renderComponent({
      type: 'queued',
      count: 1
    })

    expect(screen.getByText('Job added to queue')).toBeInTheDocument()
    expect(screen.queryByText(/1 job/)).not.toBeInTheDocument()
  })

  it('renders queued message with pluralization', () => {
    renderComponent({
      type: 'queued',
      count: 2
    })

    expect(screen.getByText('2 jobs added to queue')).toBeInTheDocument()
    expect(screen.getByTestId('notification-icon')).toHaveClass(
      'icon-[lucide--check]'
    )
  })

  it('renders queued pending message with spinner icon', () => {
    renderComponent({
      type: 'queuedPending',
      count: 1
    })

    expect(screen.getByText('Job queueing')).toBeInTheDocument()
    const icon = screen.getByTestId('notification-icon')
    expect(icon).toHaveClass('icon-[lucide--loader-circle]')
    expect(icon).toHaveClass('animate-spin')
  })

  it('renders failed message and alert icon', () => {
    renderComponent({
      type: 'failed',
      count: 1
    })

    expect(screen.getByText('Job failed')).toBeInTheDocument()
    expect(screen.getByTestId('notification-icon')).toHaveClass(
      'icon-[lucide--circle-alert]'
    )
  })

  it('renders completed message with thumbnail preview when provided', () => {
    renderComponent({
      type: 'completed',
      count: 3,
      thumbnailUrls: ['https://example.com/preview.png']
    })

    expect(screen.getByText('3 jobs completed')).toBeInTheDocument()
    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('src', 'https://example.com/preview.png')
    expect(image).toHaveAttribute('alt', 'Preview')
  })

  it('renders two completion thumbnail previews', () => {
    renderComponent({
      type: 'completed',
      count: 4,
      thumbnailUrls: [
        'https://example.com/preview-1.png',
        'https://example.com/preview-2.png'
      ]
    })

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute(
      'src',
      'https://example.com/preview-1.png'
    )
    expect(images[1]).toHaveAttribute(
      'src',
      'https://example.com/preview-2.png'
    )
  })

  it('caps completion thumbnail previews at two', () => {
    renderComponent({
      type: 'completed',
      count: 4,
      thumbnailUrls: [
        'https://example.com/preview-1.png',
        'https://example.com/preview-2.png',
        'https://example.com/preview-3.png',
        'https://example.com/preview-4.png'
      ]
    })

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute(
      'src',
      'https://example.com/preview-1.png'
    )
    expect(images[1]).toHaveAttribute(
      'src',
      'https://example.com/preview-2.png'
    )
  })
})
