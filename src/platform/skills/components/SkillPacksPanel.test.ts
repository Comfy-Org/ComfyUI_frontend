import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import SkillPacksPanel from '@/platform/skills/components/SkillPacksPanel.vue'
import type { SkillPack } from '@/platform/skills/types'

const DIALOG_HANDLE = { key: 'confirm-delete-skill-pack' }
const mockDeleteSkillPack = vi.fn().mockResolvedValue(undefined)
const mockFetchSkillPacks = vi.fn().mockResolvedValue(undefined)
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

const atPackLimit = ref(false)
const atByteLimit = ref(false)

vi.mock('@/platform/skills/composables/useSkillPacks', () => ({
  useSkillPacks: () => ({
    packs: ref<SkillPack[]>([mockPack]),
    loading: ref(false),
    atPackLimit,
    atByteLimit,
    operatingPackName: ref(null),
    fetchSkillPacks: mockFetchSkillPacks,
    deleteSkillPack: mockDeleteSkillPack
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ closeDialog: mockCloseDialog })
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
        deleteConfirmMessage: 'Delete {name}?',
        errors: {
          tooManyPacks: 'too-many-packs',
          totalAtLimit: 'total-at-limit'
        }
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
    atPackLimit.value = false
    atByteLimit.value = false
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
    expect(mockDeleteSkillPack).toHaveBeenCalledWith(mockPack)
  })

  it('blocks adding a pack and explains which limit is full when at the count budget', async () => {
    atPackLimit.value = true
    renderPanel()

    expect(screen.getByTestId('skill-packs-at-limit')).toHaveTextContent(
      'too-many-packs'
    )
    expect(
      screen.getByRole('button', { name: /Add Skill Pack/ })
    ).toBeDisabled()
  })

  it('explains the total-bytes budget when only that one is full', async () => {
    atByteLimit.value = true
    renderPanel()

    expect(screen.getByTestId('skill-packs-at-limit')).toHaveTextContent(
      'total-at-limit'
    )
  })
})
