import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import CustomNodePacksDialog from './CustomNodePacksDialog.vue'

const mocks = vi.hoisted(() => ({
  startCreateFlow: vi.fn(),
  createSession: vi.fn(),
  showEditor: vi.fn(),
  refresh: vi.fn(),
  uploadPack: vi.fn(),
  deletePack: vi.fn(),
  downloadPack: vi.fn(),
  toast: vi.fn(),
  packs: {
    __v_isRef: true,
    value: [
      {
        revisionId: 'echo-pack-x12345678',
        name: 'Echo Pack',
        uploadedAt: '2026-08-28T12:00:00Z'
      }
    ]
  },
  loading: { __v_isRef: true, value: false },
  uploading: { __v_isRef: true, value: false },
  deleting: { __v_isRef: true, value: false },
  downloadingRevisionId: { __v_isRef: true, value: null }
}))

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    name: 'Button',
    props: ['disabled', 'loading'],
    template: '<button :disabled="disabled || loading"><slot /></button>'
  }
}))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mocks.toast })
}))
vi.mock('@/platform/customNodes/composables/useCustomNodeEditor', () => ({
  useCustomNodeEditor: () => ({ createSession: mocks.createSession })
}))
vi.mock('@/platform/customNodes/composables/useCustomNodeCreateFlow', () => ({
  useCustomNodeCreateFlow: () => ({ startCreateFlow: mocks.startCreateFlow })
}))

vi.mock('@/platform/customNodes/composables/useCustomNodeEditorDialog', () => ({
  useCustomNodeEditorDialog: () => ({ show: mocks.showEditor })
}))
vi.mock('@/platform/customNodes/composables/useCustomNodePacks', () => ({
  useCustomNodePacks: () => ({
    packs: mocks.packs,
    isLoading: mocks.loading,
    isUploading: mocks.uploading,
    isDeleting: mocks.deleting,
    downloadingRevisionId: mocks.downloadingRevisionId,
    refresh: mocks.refresh,
    uploadPack: mocks.uploadPack,
    deletePack: mocks.deletePack,
    downloadPack: mocks.downloadPack
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      customNodePacks: {
        title: 'Custom node packs',
        description: 'Manage custom nodes',
        create: 'Create',
        createNode: 'Create node',
        packActions: 'Actions for {name}',
        edit: 'Edit',
        download: 'Download',
        downloadFailed: 'Download failed',
        upload: 'Upload node pack',
        uploading: 'Uploading',
        installing: 'Adding custom node pack…',
        installingWait:
          'Validating and saving the V2 pack, then updating the node library.',
        yourPacks: 'Your packs',
        loading: 'Loading custom node packs…',
        loadFailed: 'Could not load custom node packs',
        empty: 'No custom packs added',
        replace: 'Replace',
        delete: 'Delete',
        close: 'Close',
        editor: {
          starterName: 'New Custom Node',
          openFailed: 'Could not open code editor'
        }
      }
    }
  }
})

const readySession = {
  id: 'session-1',
  mode: 'create' as const,
  name: 'New Custom Node',
  status: 'creating' as const,
  editorKind: 'workbench' as const,
  agentEnabled: false,
  createdAt: '2026-08-28T12:00:00Z',
  updatedAt: '2026-08-28T12:00:00Z'
}

/** Row actions live behind the pack's overflow menu. */
async function openPackMenu() {
  await userEvent.click(
    screen.getByRole('button', { name: 'Actions for Echo Pack' })
  )
}

describe('CustomNodePacksDialog', () => {
  beforeEach(() => {
    mocks.createSession.mockReset()
    mocks.showEditor.mockReset()
    mocks.refresh.mockReset().mockResolvedValue(undefined)
    mocks.downloadPack.mockReset()
    mocks.createSession.mockResolvedValue(readySession)
    mocks.uploading.value = false
    mocks.loading.value = false
    mocks.deleting.value = false
    mocks.downloadingRevisionId.value = null
    mocks.packs.value = [
      {
        revisionId: 'echo-pack-x12345678',
        name: 'Echo Pack',
        uploadedAt: '2026-08-28T12:00:00Z'
      }
    ]
  })

  it('starts the shared create flow from Create', async () => {
    render(CustomNodePacksDialog, { global: { plugins: [i18n] } })

    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(mocks.startCreateFlow).toHaveBeenCalledWith()
    })
    // Naming and prompting belong to the flow, not this dialog.
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('edits the exact revision selected from the pack list', async () => {
    render(CustomNodePacksDialog, { global: { plugins: [i18n] } })

    await openPackMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))

    await waitFor(() => {
      expect(mocks.createSession).toHaveBeenCalledWith({
        mode: 'edit',
        name: 'Echo Pack',
        revisionId: 'echo-pack-x12345678'
      })
    })
    expect(mocks.showEditor).toHaveBeenCalledWith(readySession, mocks.refresh)
  })

  it('downloads the exact revision selected from the pack list', async () => {
    render(CustomNodePacksDialog, { global: { plugins: [i18n] } })

    await openPackMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Download' }))

    expect(mocks.downloadPack).toHaveBeenCalledWith({
      revisionId: 'echo-pack-x12345678',
      name: 'Echo Pack',
      uploadedAt: '2026-08-28T12:00:00Z'
    })
  })

  it('shows persistent progress while a pack is being stored', () => {
    mocks.uploading.value = true

    render(CustomNodePacksDialog, { global: { plugins: [i18n] } })

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Adding custom node pack…')
    expect(status).toHaveTextContent(
      'Validating and saving the V2 pack, then updating the node library.'
    )
  })

  it('shows list loading instead of a false empty state', () => {
    mocks.loading.value = true
    mocks.packs.value = []

    render(CustomNodePacksDialog, { global: { plugins: [i18n] } })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading custom node packs…'
    )
    expect(screen.queryByText('No custom packs added')).not.toBeInTheDocument()
  })
})
