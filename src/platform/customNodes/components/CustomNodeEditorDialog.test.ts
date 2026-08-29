import { render, waitFor } from '@testing-library/vue'
import type * as VueUse from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { CustomNodeEditorRequestError } from '../composables/useCustomNodeEditor'
import CustomNodeEditorDialog from './CustomNodeEditorDialog.vue'

const mocks = vi.hoisted(() => ({
  RequestError: class extends Error {
    constructor(
      message: string,
      readonly status: number
    ) {
      super(message)
    }
  },
  abandonSession: vi.fn(),
  getSession: vi.fn(),
  intervalCallback: null as null | (() => Promise<void>),
  pause: vi.fn(),
  refreshNodeDefinitions: vi.fn(),
  reportError: vi.fn(),
  toast: vi.fn()
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof VueUse>()
  return {
    ...actual,
    useIntervalFn: (callback: () => Promise<void>) => {
      mocks.intervalCallback = callback
      return { pause: mocks.pause }
    }
  }
})
vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    name: 'Button',
    props: ['disabled', 'loading'],
    template: '<button :disabled="disabled || loading"><slot /></button>'
  }
}))
vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mocks.reportError
}))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mocks.toast })
}))
vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ confirm: vi.fn() })
}))
vi.mock('../composables/useCustomNodeEditor', () => ({
  CustomNodeEditorRequestError: mocks.RequestError,
  useCustomNodeEditor: () => ({
    abandonSession: mocks.abandonSession,
    getSession: mocks.getSession,
    refreshNodeDefinitions: mocks.refreshNodeDefinitions
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      customNodePacks: {
        editor: {
          abandon: 'Abandon',
          frameTitle: 'Custom node code editor',
          sessionEnded: 'Editor session ended',
          sessionEndedDetail:
            'This editor is no longer running. Open Create or Edit again to start a fresh session.',
          status: { ready: 'Ready' },
          title: 'Editing {name}'
        }
      }
    }
  }
})

const readySession = {
  id: 'expired-session',
  mode: 'edit' as const,
  name: 'Echo Pack',
  status: 'ready' as const,
  createdAt: '2026-08-29T12:00:00Z',
  updatedAt: '2026-08-29T12:00:01Z'
}

describe('CustomNodeEditorDialog', () => {
  beforeEach(() => {
    mocks.abandonSession.mockReset()
    mocks.getSession.mockReset()
    mocks.intervalCallback = null
    mocks.pause.mockReset()
    mocks.refreshNodeDefinitions.mockReset()
    mocks.reportError.mockReset()
    mocks.toast.mockReset()
  })

  it('closes a stale editor session instead of leaving an empty iframe', async () => {
    const onClose = vi.fn()
    mocks.getSession.mockRejectedValueOnce(
      new CustomNodeEditorRequestError('editor session was not found', 404)
    )

    render(CustomNodeEditorDialog, {
      props: {
        initialSession: readySession,
        onClose,
        onSubmitted: vi.fn()
      },
      global: { plugins: [i18n] }
    })

    await mocks.intervalCallback?.()

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(mocks.pause).toHaveBeenCalledOnce()
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warn',
        summary: 'Editor session ended'
      })
    )
    expect(mocks.reportError).not.toHaveBeenCalled()
  })
})
