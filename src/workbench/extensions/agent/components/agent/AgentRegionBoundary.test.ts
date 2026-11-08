import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import type { Component, VNodeChild } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'

import AgentRegionBoundary from './AgentRegionBoundary.vue'

vi.mock(import('@comfyorg/telemetry/reportError'))

function throwsWhileRendering(error: Error) {
  return defineComponent({
    render() {
      throw error
    }
  })
}

function renderPanel(regionSlots: Record<string, () => VNodeChild>) {
  return render(
    defineComponent({
      setup: () => () => [
        h(AgentRegionBoundary, { region: 'sidebar' }, regionSlots),
        h('button', 'Send')
      ]
    })
  )
}

describe('AgentRegionBoundary', () => {
  it('renders its region and not the fallback while nothing fails', () => {
    renderPanel({
      default: () => h('p', 'Chats'),
      fallback: () => h('p', 'Chats are unavailable')
    })

    expect(screen.getByText('Chats')).toBeInTheDocument()
    expect(screen.queryByText('Chats are unavailable')).not.toBeInTheDocument()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('hides a region whose child throws while rendering and keeps the rest of the panel', async () => {
    const BrokenList = throwsWhileRendering(new Error('render failed'))
    renderPanel({ default: () => [h('p', 'Chats'), h(BrokenList)] })
    await nextTick()

    expect(screen.queryByText('Chats')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
  })

  it('reports only the first error, tagged with its region', async () => {
    const firstError = new Error('first failure')
    const First = throwsWhileRendering(firstError)
    const Second = throwsWhileRendering(new Error('second failure'))
    renderPanel({ default: () => [h(First), h(Second)] })
    await nextTick()

    expect(reportError).toHaveBeenCalledExactlyOnceWith(firstError, {
      surface: 'agent',
      errorType: 'error_rendering_agent_region',
      tags: { region: 'sidebar' },
      context: { info: 'render function' }
    })
  })

  it('shows the fallback in place of a failed region', async () => {
    const BrokenList = throwsWhileRendering(new Error('render failed'))
    renderPanel({
      default: () => h(BrokenList),
      fallback: () => h('p', 'Chats are unavailable')
    })
    await nextTick()

    expect(screen.getByText('Chats are unavailable')).toBeInTheDocument()
  })

  it('contains an error thrown from an event handler inside the region', async () => {
    const clickError = new Error('click failed')
    const RenameChat = defineComponent({
      setup: () => () =>
        h(
          'button',
          {
            onClick: () => {
              throw clickError
            }
          },
          'Rename chat'
        )
    })
    const user = userEvent.setup()
    renderPanel({ default: () => h(RenameChat) })

    await user.click(screen.getByRole('button', { name: 'Rename chat' }))
    await nextTick()

    expect(
      screen.queryByRole('button', { name: 'Rename chat' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(clickError, {
      surface: 'agent',
      errorType: 'error_rendering_agent_region',
      tags: { region: 'sidebar' },
      context: { info: 'native event handler' }
    })
  })

  it('stays hidden until its parent remounts it', async () => {
    const Chats = defineComponent({ setup: () => () => h('p', 'Chats') })
    const list = shallowRef<Component>(
      throwsWhileRendering(new Error('render failed'))
    )
    const attempt = ref(0)
    render(
      defineComponent({
        setup: () => () =>
          h(
            AgentRegionBoundary,
            { region: 'sidebar', key: attempt.value },
            { default: () => h(list.value) }
          )
      })
    )
    await nextTick()

    list.value = Chats
    await nextTick()
    expect(screen.queryByText('Chats')).not.toBeInTheDocument()

    attempt.value++
    await nextTick()
    expect(screen.getByText('Chats')).toBeInTheDocument()
  })
})
