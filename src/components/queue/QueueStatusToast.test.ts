import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import QueueStatusToast from '@/components/queue/QueueStatusToast.vue'
import { i18n } from '@/i18n'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'

vi.mock(import('firebase/auth'))
vi.mock(import('@/platform/billing/composables/useSubscriptionPaywall'))

const STORAGE_KEY = 'Comfy.QueueStatus.Jobs'
const NOW = Date.UTC(2026, 10, 24, 12, 0, 0)

function runningTask(id: string, executionStartTime?: number) {
  return new TaskItemImpl({
    id,
    status: 'in_progress',
    create_time: NOW - 600_000,
    priority: 1,
    outputs_count: 0,
    previewable_outputs_count: 0,
    execution_start_time: executionStartTime
  })
}

async function openCard(tasks: TaskItemImpl[]) {
  useQueueStore().runningTasks = tasks
  render(QueueStatusToast, {
    global: { plugins: [i18n], stubs: { MediaLightbox: true } }
  })
  await userEvent.click(await screen.findByTestId('queue-status-toast'))
  return screen.findAllByTestId('queue-status-row')
}

function remember(memory: Record<string, object>) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
}

describe('QueueStatusToast after a reload', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('names a run by its remembered workflow when no open tab matches it', async () => {
    remember({ a: { name: 'Portrait batch' } })
    const [row] = await openCard([runningTask('a')])
    expect(row).toHaveTextContent('Portrait batch')
    expect(row).not.toHaveTextContent('Untitled')
  })

  it('keeps counting from the remembered start instead of restarting', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    remember({ a: { startedAt: NOW - 65_000 } })
    const [row] = await openCard([runningTask('a')])
    expect(row).toHaveTextContent('1:05')
  })

  it('prefers the server start time over the remembered one', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    remember({ a: { startedAt: NOW - 10_000 } })
    const [row] = await openCard([runningTask('a', NOW - 125_000)])
    expect(row).toHaveTextContent('2:05')
  })

  it('remembers when it first saw a run start', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    await openCard([runningTask('a')])
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      a: { startedAt: NOW }
    })
  })
})
