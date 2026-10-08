import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import type * as CustomNodeEditor from '../composables/useCustomNodeEditor'

import CustomNodeDraftTestPanel from './CustomNodeDraftTestPanel.vue'

const mocks = vi.hoisted(() => ({
  getFiles: vi.fn(),
  createDraftTest: vi.fn(),
  getDraftTest: vi.fn(),
  deleteDraftTest: vi.fn(),
  reportError: vi.fn()
}))
vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mocks.reportError
}))
vi.mock('../composables/useCustomNodeEditor', async (importOriginal) => {
  const original = await importOriginal<typeof CustomNodeEditor>()
  return { ...original, useCustomNodeEditor: () => mocks }
})
vi.mock('@/components/ui/single-select/SingleSelect.vue', () => ({
  default: {
    props: ['modelValue', 'options', 'label', 'disabled'],
    emits: ['update:modelValue'],
    template:
      '<select :value="modelValue" :aria-label="label" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in options" :key="item.value" :value="item.value">{{ item.name }}</option></select>'
  }
}))
vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    props: ['disabled', 'loading'],
    template: '<button :disabled="disabled || loading"><slot /></button>'
  }
}))
const workflow = 'v2/tests/workflows/image.json'
const files = {
  files: [{ path: workflow, content: '{}', editable: true }],
  directories: [],
  digest: 'saved-digest'
}
const draft = {
  id: 'test-1',
  status: 'passed',
  result: { sandbox: 'gvisor', duration_ms: 50, outputs: [] }
}
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      customNodePacks: {
        editor: {
          draftTest: {
            workflow: 'Draft test workflow',
            run: 'Test Draft',
            failed: 'Test unavailable',
            workflowMissing: 'Workflow missing',
            details: '{sandbox} · {duration} ms · {count} outputs',
            status: {
              queued: 'Queued',
              running: 'Running',
              passed: 'Backend test passed',
              failed: 'Backend test failed'
            }
          }
        }
      }
    }
  }
})

describe('CustomNodeDraftTestPanel', () => {
  beforeEach(() => {
    mocks.getFiles.mockResolvedValue(files)
    mocks.createDraftTest.mockResolvedValue(draft)
    mocks.deleteDraftTest.mockResolvedValue(undefined)
  })

  function setup() {
    const beforeTest = vi.fn().mockResolvedValue(undefined)
    const view = render(CustomNodeDraftTestPanel, {
      props: { sessionId: 'session-1', disabled: false, beforeTest },
      global: { plugins: [i18n] }
    })
    return { ...view, beforeTest }
  }

  it('saves first, then tests the current exact file snapshot without an agent', async () => {
    const user = userEvent.setup()
    const { beforeTest } = setup()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Test Draft' })).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: 'Test Draft' }))
    expect(beforeTest).toHaveBeenCalledOnce()
    expect(beforeTest.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getFiles.mock.invocationCallOrder[1]
    )
    expect(mocks.createDraftTest).toHaveBeenCalledWith('session-1', {
      files: [{ path: workflow, content: '{}' }],
      workflow_path: workflow,
      snapshot_digest: 'saved-digest'
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Backend test passed'
    )
    expect(screen.getByText('gvisor · 50 ms · 0 outputs')).toBeVisible()
  })

  it('reports backend failure rather than declaring a successful test', async () => {
    mocks.createDraftTest.mockResolvedValue({
      ...draft,
      status: 'failed',
      error: 'Node rejected'
    })
    const user = userEvent.setup()
    setup()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Test Draft' })).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: 'Test Draft' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Node rejected')
    expect(screen.getByRole('status')).toHaveTextContent('Backend test failed')
  })

  it('does not launch a workflow that disappeared during the save', async () => {
    mocks.getFiles
      .mockResolvedValueOnce(files)
      .mockResolvedValueOnce({ ...files, files: [] })
    const user = userEvent.setup()
    setup()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Test Draft' })).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: 'Test Draft' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Workflow missing'
    )
    expect(mocks.createDraftTest).not.toHaveBeenCalled()
    expect(mocks.reportError).toHaveBeenCalledOnce()
  })

  it('cancels a test whose launch finishes after the editor was closed', async () => {
    let resolve: ((value: typeof draft) => void) | undefined
    mocks.createDraftTest.mockReturnValue(
      new Promise<typeof draft>((done) => {
        resolve = done
      })
    )
    const user = userEvent.setup()
    const { unmount } = setup()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Test Draft' })).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: 'Test Draft' }))
    expect(mocks.createDraftTest).toHaveBeenCalledOnce()
    unmount()
    resolve?.(draft)
    await waitFor(() =>
      expect(mocks.deleteDraftTest).toHaveBeenCalledWith('session-1', 'test-1')
    )
    expect(mocks.getDraftTest).not.toHaveBeenCalled()
  })
})
