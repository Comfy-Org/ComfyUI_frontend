import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
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

const DIALOG_HANDLE: ReturnType<typeof showConfirmDialog> = {
  key: 'confirm-delete-skill-pack',
  visible: true,
  component: defineComponent(() => () => null),
  contentProps: {},
  dialogComponentProps: {},
  priority: 0
}
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

vi.mock(import('@/platform/skills/api/skillsApi'), { spy: true })

vi.mock(import('@/components/dialog/confirm/confirmDialog'))

const mockShowConfirmDialog = vi.mocked(showConfirmDialog)

function capturedOptions() {
  const options = mockShowConfirmDialog.mock.calls[0]?.[0]
  assert.exists(options)
  return options
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      g: { edit: 'Edit', delete: 'Delete' },
      skillPacks: {
        title: 'Agent Skill Packs',
        panelDescription: 'Teach the agent a preference',
        yourPacks: 'Your Packs',
        addPack: 'Add Skill Pack',
        noPacks: 'No skill packs yet',
        packSize: '{bytes} bytes',
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
        SkillPackFormDialog: {
          template:
            '<div v-if="visible" role="dialog" :aria-label="pack?.name">{{ pack?.body }}</div>',
          props: ['visible', 'pack']
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
    mockShowConfirmDialog.mockReturnValue(DIALOG_HANDLE)
  })

  it('opens the existing editor with full instructions when a row is clicked', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByRole('button', { name: mockPack.name }))

    expect(
      screen.getByRole('dialog', { name: mockPack.name })
    ).toHaveTextContent(mockPack.body)
    expect(mockShowConfirmDialog).not.toHaveBeenCalled()
  })

  it('routes delete confirmation through showConfirmDialog with destructive variant', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    const opts = capturedOptions()
    expect(opts.props?.promptText).toBe('Delete my-render-defaults?')
    expect(opts.footerProps?.confirmVariant).toBe('destructive')
  })

  it('onConfirm closes the dialog with the helper handle and deletes the pack', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    const onConfirm = capturedOptions().footerProps?.onConfirm
    assert(typeof onConfirm === 'function')
    await onConfirm()

    expect(mockCloseDialog).toHaveBeenCalledExactlyOnceWith(DIALOG_HANDLE)
    expect(deleteSkillPackApi).toHaveBeenCalledWith(mockPack.name)
    expect(useSkillPacksStore().packs).toEqual([])
  })

  it('cancel closes confirmation and preserves the pack', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    const onCancel = capturedOptions().footerProps?.onCancel
    assert(typeof onCancel === 'function')
    onCancel()

    expect(mockCloseDialog).toHaveBeenCalledExactlyOnceWith(DIALOG_HANDLE)
    expect(deleteSkillPackApi).not.toHaveBeenCalled()
    expect(useSkillPacksStore().packs).toEqual([mockPack])
  })
})
