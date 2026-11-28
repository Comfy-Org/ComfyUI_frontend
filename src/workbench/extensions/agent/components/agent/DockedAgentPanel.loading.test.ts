import { render, screen } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, onMounted } from 'vue'

import { i18n } from '@/i18n'
import { useAgentPanelRenderStore } from '@/workbench/extensions/agent/stores/agent/agentPanelRenderStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useAgentRunModeStore } from '@/workbench/extensions/agent/stores/agent/agentRunModeStore'

import DockedAgentPanel from './DockedAgentPanel.vue'

const rootImport = vi.hoisted(() => {
  let resolve = (): void => undefined
  const promise = new Promise<void>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
})
const rootModuleLoaded = vi.hoisted(() => {
  let resolve = (): void => undefined
  const promise = new Promise<void>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
})
const rootMounted = vi.hoisted(() => vi.fn())

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/workbench/extensions/agent/AgentPanelRoot.vue'), async () => {
  await rootImport.promise
  rootModuleLoaded.resolve()
  return {
    __esModule: true,
    default: defineComponent({
      name: 'AgentPanelRoot',
      setup() {
        const renderStore = useAgentPanelRenderStore()
        onMounted(() => {
          rootMounted()
          renderStore.reach('drawn')
        })
        return () =>
          h(
            'section',
            { role: 'region', 'aria-label': 'Agent content' },
            'Agent ready'
          )
      }
    })
  }
})

it('shows localized loading feedback only while an opened panel waits for its root', async () => {
  vi.useFakeTimers()
  vi.spyOn(useAgentRunModeStore(), 'load').mockResolvedValue()
  const store = useAgentPanelStore()
  store.enabled = true
  store.consentAccepted = true
  store.isOpen = false
  render(DockedAgentPanel, { global: { plugins: [i18n] } })

  expect(screen.queryByRole('progressbar', { name: 'Loading' })).toBeNull()

  store.isOpen = true
  await nextTick()
  expect(screen.queryByRole('progressbar', { name: 'Loading' })).toBeNull()

  await vi.advanceTimersByTimeAsync(200)
  expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeVisible()
  expect(screen.getByText('Loading')).toBeVisible()
  expect(
    screen.getByRole('complementary', { name: 'Comfy Agent' })
  ).toBeVisible()

  store.isOpen = false
  await nextTick()
  expect(screen.queryByRole('progressbar', { name: 'Loading' })).toBeNull()

  vi.useRealTimers()
  rootImport.resolve()
  await rootModuleLoaded.promise
  await nextTick()
  expect(screen.queryByRole('region', { name: 'Agent content' })).toBeNull()

  store.isOpen = true
  expect(
    await screen.findByRole('region', { name: 'Agent content' })
  ).toBeVisible()
  expect(screen.queryByRole('progressbar', { name: 'Loading' })).toBeNull()
  expect(rootMounted).toHaveBeenCalledOnce()
})
