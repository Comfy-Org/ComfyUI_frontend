import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import {
  deleteSkillPack as deleteSkillPackApi,
  listSkillPacks
} from '@/platform/skills/api/skillsApi'
import SkillPacksPanel from '@/platform/skills/components/SkillPacksPanel.vue'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillPack } from '@/platform/skills/types'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_HANDLE = { key: 'confirm-delete-skill-pack' }
const mockCloseDialog = vi.fn()

const mockPack: SkillPack = {
  id: 'pack-1',
  name: 'my-render-defaults',
  description: 'load me when upscaling',
  body: 'always upscale with 4x-UltraSharp',
  body_hash: 'abc',
  created_at: '2026-08-22T00:00:00Z',
  updated_at: '2026-08-22T00:00:00Z'
}

vi.mock(import('@/platform/skills/api/skillsApi'), () => ({
  listSkillPacks: vi.fn(),
  deleteSkillPack: vi.fn(),
  SkillPacksApiError: class SkillPacksApiError extends Error {
    constructor(
      message: string,
      public readonly status: number
    ) {
      super(message)
    }
  }
}))

vi.mock('@/components/dialog/confirm/confirmDialog')

vi.mock('@/platform/skills/components/SkillPackFormDialog.vue', () => ({
  default: { name: 'SkillPackFormDialog', template: '<div />' }
}))

const mockShowConfirmDialog = vi.mocked(showConfirmDialog)

interface CapturedConfirmOptions {
  headerProps: { title: string }
  props: { promptText: string }
  footerProps: {
    confirmText: string
    confirmVariant: string
    onCancel: () => void
    onConfirm: () => Promise<void>
  }
}

function capturedOptions(): CapturedConfirmOptions {
  return mockShowConfirmDialog.mock
    .calls[0][0] as unknown as CapturedConfirmOptions
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      g: { delete: 'Delete' },
      skillPacks: {
        title: 'Agent Skill Packs',
        panelDescription: 'Teach the agent a preference',
        yourPacks: 'Your Packs',
        addPack: 'Add Skill Pack',
        noPacks: 'No skill packs yet',
        deleteConfirmTitle: 'Delete Skill Pack',
        deleteConfirmMessage: 'Delete {name}?'
      }
    }
  }
})

function renderPanel() {
  return render(SkillPacksPanel, {
    global: {
      plugins: [i18n],
      stubs: {
        Button: {
          template:
            '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          props: ['disabled']
        },
        SkillPackListItem: {
          template:
            '<button data-testid="delete-trigger" @click="$emit(\'delete\')">delete</button>',
          props: ['pack', 'loading', 'disabled'],
          emits: ['edit', 'delete']
        }
      }
    }
  })
}

describe('SkillPacksPanel', () => {
  beforeEach(() => {
    useSkillPacksStore().packs = [mockPack]
    vi.mocked(listSkillPacks).mockResolvedValue([mockPack])
    vi.mocked(deleteSkillPackApi).mockResolvedValue(undefined)
    vi.mocked(useDialogStore().closeDialog).mockImplementation(mockCloseDialog)
    mockShowConfirmDialog.mockReturnValue(
      DIALOG_HANDLE as ReturnType<typeof showConfirmDialog>
    )
  })

  it('routes delete confirmation through showConfirmDialog with destructive variant', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByTestId('delete-trigger'))

    const opts = capturedOptions()
    expect(opts.props.promptText).toBe('Delete my-render-defaults?')
    expect(opts.footerProps.confirmVariant).toBe('destructive')
  })

  it('onConfirm closes the dialog with the helper handle and deletes the pack', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByTestId('delete-trigger'))

    await capturedOptions().footerProps.onConfirm()

    expect(mockCloseDialog).toHaveBeenCalledExactlyOnceWith(DIALOG_HANDLE)
    expect(deleteSkillPackApi).toHaveBeenCalledWith(mockPack.name)
    expect(useSkillPacksStore().packs).toEqual([])
  })
})
