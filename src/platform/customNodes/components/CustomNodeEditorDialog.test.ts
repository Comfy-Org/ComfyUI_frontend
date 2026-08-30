import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
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
  renameSession: vi.fn(),
  runSessionAction: vi.fn(),
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
    renameSession: mocks.renameSession,
    runSessionAction: mocks.runSessionAction,
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
          actionFailed: 'Could not run editor action',
          controlsUnavailable:
            'VS Code tools are still starting. Try again in a moment.',
          editing: 'Editing',
          editName: 'Edit custom node pack name',
          frameTitle: 'Custom node code editor',
          invalidName:
            'Use 1–80 letters, numbers, spaces, dots, dashes, or underscores.',
          nameHint: 'Press Enter or leave the field to save the pack name.',
          nameLabel: 'Custom node pack name',
          renameFailed: 'Could not rename custom node pack.',
          renaming: 'Renaming pack…',
          sessionEnded: 'Editor session ended',
          sessionEndedDetail:
            'This editor is no longer running. Open Create or Edit again to start a fresh session.',
          status: { ready: 'Ready' },
          submit: 'Submit Node',
          submitted: 'Custom node submitted',
          submittedDetail: 'The new revision is stored and ready to use.',
          title: 'Editing {name}',
          validate: 'Validate Node',
          validated: 'Custom node is valid',
          validatedDetail: 'The custom node passed validation.',
          validating: 'Validating node…'
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
    mocks.renameSession.mockReset()
    mocks.runSessionAction.mockReset()
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

  it('renames the pack from the top bar', async () => {
    const user = userEvent.setup()
    mocks.renameSession.mockResolvedValueOnce({
      ...readySession,
      name: 'Gradient Mask'
    })

    render(CustomNodeEditorDialog, {
      props: {
        initialSession: readySession,
        onClose: vi.fn(),
        onSubmitted: vi.fn()
      },
      global: { plugins: [i18n] }
    })

    const nameInput = screen.getByRole('textbox', {
      name: 'Custom node pack name'
    })
    await user.clear(nameInput)
    await user.type(nameInput, 'Gradient Mask{Enter}')

    await waitFor(() =>
      expect(mocks.renameSession).toHaveBeenCalledWith(
        'expired-session',
        'Gradient Mask'
      )
    )
    expect(nameInput).toHaveValue('Gradient Mask')
  })

  it('selects the complete pack name from the pencil action', async () => {
    const user = userEvent.setup()

    render(CustomNodeEditorDialog, {
      props: {
        initialSession: readySession,
        onClose: vi.fn(),
        onSubmitted: vi.fn()
      },
      global: { plugins: [i18n] }
    })

    const nameInput = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'Custom node pack name'
    })
    await user.click(
      screen.getByRole('button', { name: 'Edit custom node pack name' })
    )

    expect(nameInput).toHaveFocus()
    expect(nameInput.selectionStart).toBe(0)
    expect(nameInput.selectionEnd).toBe(readySession.name.length)
  })

  it('shows validation and submission beside abandon in the top bar', () => {
    render(CustomNodeEditorDialog, {
      props: {
        initialSession: readySession,
        onClose: vi.fn(),
        onSubmitted: vi.fn()
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getByRole('button', { name: 'Validate Node' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Submit Node' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Abandon' })).toBeVisible()
  })

  it('submits through the editor action API and closes after refresh', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSubmitted = vi.fn()
    mocks.runSessionAction.mockResolvedValueOnce({
      ...readySession,
      status: 'submitted',
      revisionId: 'echo-pack-x87654321'
    })
    mocks.refreshNodeDefinitions.mockResolvedValueOnce(undefined)

    render(CustomNodeEditorDialog, {
      props: { initialSession: readySession, onClose, onSubmitted },
      global: { plugins: [i18n] }
    })

    await user.click(screen.getByRole('button', { name: 'Submit Node' }))

    await waitFor(() =>
      expect(mocks.runSessionAction).toHaveBeenCalledWith(
        'expired-session',
        'submit'
      )
    )
    expect(mocks.refreshNodeDefinitions).toHaveBeenCalledWith('expired-session')
    expect(onSubmitted).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps an invalid name editable without calling the server', async () => {
    const user = userEvent.setup()
    render(CustomNodeEditorDialog, {
      props: {
        initialSession: readySession,
        onClose: vi.fn(),
        onSubmitted: vi.fn()
      },
      global: { plugins: [i18n] }
    })

    const nameInput = screen.getByRole('textbox', {
      name: 'Custom node pack name'
    })
    await user.clear(nameInput)
    await user.type(nameInput, 'Invalid/Pack{Enter}')

    expect(mocks.renameSession).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Use 1–80 letters, numbers, spaces, dots, dashes, or underscores.'
    )
    expect(nameInput).toHaveValue('Invalid/Pack')
  })
})
