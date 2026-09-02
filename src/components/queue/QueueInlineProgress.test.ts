import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import QueueInlineProgress from '@/components/queue/QueueInlineProgress.vue'

const mockProgress = vi.hoisted(() => ({
  totalPercent: null! as Ref<number>,
  currentNodePercent: null! as Ref<number>
}))

vi.mock('@/composables/queue/useQueueProgress', () => ({
  useQueueProgress: () => ({
    totalPercent: mockProgress.totalPercent,
    currentNodePercent: mockProgress.currentNodePercent
  })
}))

function renderComponent(props: { hidden?: boolean } = {}) {
  return render(QueueInlineProgress, { props })
}

describe('QueueInlineProgress', () => {
  beforeEach(() => {
    mockProgress.totalPercent = ref(0)
    mockProgress.currentNodePercent = ref(0)
  })

  it('renders when total progress is non-zero', () => {
    mockProgress.totalPercent.value = 12

    renderComponent()

    expect(screen.getByTestId('queue-inline-progress')).toBeInTheDocument()
  })

  it('renders when current node progress is non-zero', () => {
    mockProgress.currentNodePercent.value = 33

    renderComponent()

    expect(screen.getByTestId('queue-inline-progress')).toBeInTheDocument()
  })

  it('does not render when hidden', () => {
    mockProgress.totalPercent.value = 45

    renderComponent({ hidden: true })

    expect(
      screen.queryByTestId('queue-inline-progress')
    ).not.toBeInTheDocument()
  })

  it('shows when progress becomes non-zero', async () => {
    renderComponent()

    expect(
      screen.queryByTestId('queue-inline-progress')
    ).not.toBeInTheDocument()

    mockProgress.totalPercent.value = 10
    await nextTick()
    expect(screen.getByTestId('queue-inline-progress')).toBeInTheDocument()
  })

  it('hides when progress returns to zero', async () => {
    mockProgress.totalPercent.value = 10

    renderComponent()

    expect(screen.getByTestId('queue-inline-progress')).toBeInTheDocument()

    mockProgress.totalPercent.value = 0
    mockProgress.currentNodePercent.value = 0
    await nextTick()
    expect(
      screen.queryByTestId('queue-inline-progress')
    ).not.toBeInTheDocument()
  })
})
