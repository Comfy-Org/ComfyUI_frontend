import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import { useToast } from '@/components/ui/toast/toastStore'
import { i18n } from '@/i18n'
import {
  deleteSkillPack,
  listSkillPacks,
  SkillPacksApiError
} from '@/platform/skills/api/skillsApi'
import { useSkillDraftStore } from '@/platform/skills/stores/skillDraftStore'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillPack } from '@/platform/skills/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

import AgentSkillList from './AgentSkillList.vue'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/skills/api/skillsApi'), { spy: true })
vi.mock(import('@/components/dialog/confirm/confirmDialog'))

const DIALOG_HANDLE: ReturnType<typeof showConfirmDialog> = {
  key: 'confirm-delete-skill',
  visible: true,
  component: defineComponent(() => () => null),
  contentProps: {},
  dialogComponentProps: {},
  priority: 0
}
const mockCloseDialog = vi.fn()
const mockShowConfirmDialog = vi.mocked(showConfirmDialog)

function pack(name: string, description: string): SkillPack {
  return {
    id: name,
    name,
    description,
    body: 'Instructions',
    body_hash: 'hash',
    created_at: '2026-10-06T00:00:00Z',
    updated_at: '2026-10-06T00:00:00Z'
  }
}

const LANDSCAPE = pack('landscape', 'Compose a landscape')
const PORTRAIT = pack('portrait', 'Compose a portrait')

function seedCatalog(packs: SkillPack[]) {
  const skills = useSkillPacksStore()
  skills.flagsEnabled = true
  skills.hasLoaded = true
  skills.catalogConfirmed = true
  skills.packs = packs
  vi.mocked(listSkillPacks).mockResolvedValue(packs)
}

function mount() {
  const user = userEvent.setup()
  const view = render(AgentSkillList, { global: { plugins: [i18n] } })
  return { ...view, user }
}

const DRAFT = {
  name: 'sunset',
  description: 'Compose a sunset',
  body: 'Warm light'
}

function seedDraft(
  target: Parameters<ReturnType<typeof useSkillDraftStore>['setDraft']>[1],
  fields = DRAFT
) {
  useSkillDraftStore().setDraft(useSkillPacksStore().scope, target, fields)
}

type User = ReturnType<typeof userEvent.setup>

async function chooseDelete(user: User, name: string) {
  await user.click(screen.getByRole('button', { name: `Options for ${name}` }))
  await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
}

function capturedOptions() {
  const options = mockShowConfirmDialog.mock.calls[0]?.[0]
  assert.exists(options)
  return options
}

function confirmDeletion() {
  const onConfirm = capturedOptions().footerProps?.onConfirm
  assert(typeof onConfirm === 'function')
  return onConfirm()
}

function pendingDelete() {
  let settle: { resolve: () => void; reject: (error: Error) => void }
  vi.mocked(deleteSkillPack).mockReturnValueOnce(
    new Promise<void>((resolve, reject) => {
      settle = { resolve, reject }
    })
  )
  return {
    resolve: () => settle.resolve(),
    reject: (error: Error) => settle.reject(error)
  }
}

describe('AgentSkillList row actions', () => {
  beforeEach(() => {
    seedCatalog([LANDSCAPE, PORTRAIT])
    vi.mocked(deleteSkillPack).mockResolvedValue(undefined)
    vi.mocked(useDialogStore().closeDialog).mockImplementation(mockCloseDialog)
    mockShowConfirmDialog.mockReturnValue(DIALOG_HANDLE)
  })

  it('shows an options button on every row without any hover', () => {
    mount()

    expect(
      screen.getByRole('button', { name: 'Options for landscape' })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Options for portrait' })
    ).toBeVisible()
  })

  it('opens a skill for editing from its row menu', async () => {
    const { user, emitted } = mount()
    await user.click(
      screen.getByRole('button', { name: 'Options for portrait' })
    )

    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))

    expect(emitted().edit).toEqual([[PORTRAIT]])
  })

  it('tabs through Back, Add, then each row followed by its options button', async () => {
    const { user } = mount()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Back to chat' })).toHaveFocus()
    )

    await user.tab()
    expect(screen.getByRole('button', { name: 'Add skill' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'landscape' })).toHaveFocus()
    await user.tab()
    expect(
      screen.getByRole('button', { name: 'Options for landscape' })
    ).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'portrait' })).toHaveFocus()
    await user.tab()
    expect(
      screen.getByRole('button', { name: 'Options for portrait' })
    ).toHaveFocus()
  })

  it('opens a skill for editing when Enter is pressed on its row', async () => {
    const { user, emitted } = mount()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Back to chat' })).toHaveFocus()
    )
    screen.getByRole('button', { name: 'portrait' }).focus()

    await user.keyboard('{Enter}')

    expect(emitted().edit).toEqual([[PORTRAIT]])
  })

  it('chooses Edit from the row menu with the keyboard', async () => {
    const { user, emitted } = mount()
    await user.click(
      screen.getByRole('button', { name: 'Options for landscape' })
    )
    await screen.findByRole('menuitem', { name: 'Edit' })

    await user.keyboard('{ArrowDown}{Enter}')

    expect(emitted().edit).toEqual([[LANDSCAPE]])
  })

  it('returns focus to its options button when the row menu is dismissed with Escape', async () => {
    const { user } = mount()
    const options = screen.getByRole('button', {
      name: 'Options for landscape'
    })
    await user.click(options)
    await screen.findByRole('menuitem', { name: 'Edit' })

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menuitem')).toBeNull()
    expect(options).toHaveFocus()
  })

  describe('deleting a skill', () => {
    it('asks for confirmation that names the skill, and deletes nothing yet', async () => {
      const { user } = mount()

      await chooseDelete(user, 'landscape')

      const options = capturedOptions()
      expect(options.headerProps?.title).toBe('Delete skill')
      expect(options.props?.promptText).toBe(
        'Are you sure you want to delete "landscape"? This action cannot be undone.'
      )
      expect(options.footerProps?.confirmVariant).toBe('destructive')
      expect(deleteSkillPack).not.toHaveBeenCalled()
    })

    it('changes nothing when the confirmation is cancelled', async () => {
      const { user } = mount()
      await chooseDelete(user, 'landscape')

      const onCancel = capturedOptions().footerProps?.onCancel
      assert(typeof onCancel === 'function')
      onCancel()

      expect(mockCloseDialog).toHaveBeenCalledExactlyOnceWith(DIALOG_HANDLE)
      expect(deleteSkillPack).not.toHaveBeenCalled()
      expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })

    it('marks the row busy and the others unavailable until the delete settles, then drops the row and focuses Add', async () => {
      const deletion = pendingDelete()
      const { user } = mount()
      await chooseDelete(user, 'landscape')

      const confirmed = confirmDeletion()

      const landscape = screen.getByRole('button', { name: 'landscape' })
      await waitFor(() => expect(landscape).toBeDisabled())
      expect(landscape).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByRole('button', { name: 'portrait' })).toBeDisabled()
      expect(
        screen.getByRole('button', { name: 'Options for portrait' })
      ).toBeDisabled()
      expect(deleteSkillPack).toHaveBeenCalledExactlyOnceWith('landscape')

      deletion.resolve()
      await confirmed

      expect(mockCloseDialog).toHaveBeenCalledExactlyOnceWith(DIALOG_HANDLE)
      expect(screen.queryByRole('button', { name: 'landscape' })).toBeNull()
      expect(screen.getByRole('button', { name: 'portrait' })).toBeEnabled()
      expect(
        screen.getByRole('button', { name: 'Options for portrait' })
      ).toBeEnabled()
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add skill' })).toHaveFocus()
      )
    })

    it('shows the empty state once the last skill is deleted', async () => {
      seedCatalog([LANDSCAPE])
      const { user } = mount()
      await chooseDelete(user, 'landscape')

      await confirmDeletion()

      expect(await screen.findByText('No skills yet')).toBeVisible()
      expect(screen.queryByRole('listitem')).toBeNull()
    })

    it('treats a 404 as already removed and lists the skills again', async () => {
      vi.mocked(deleteSkillPack).mockRejectedValueOnce(
        new SkillPacksApiError('missing', 404)
      )
      const { user } = mount()
      await chooseDelete(user, 'landscape')
      vi.mocked(listSkillPacks).mockResolvedValue([PORTRAIT])

      await confirmDeletion()

      await waitFor(() => expect(listSkillPacks).toHaveBeenCalledTimes(2))
      expect(screen.queryByRole('button', { name: 'landscape' })).toBeNull()
      expect(screen.getByRole('button', { name: 'portrait' })).toBeEnabled()
      expect(useToast().toasts).toEqual([])
    })

    it.for<[string, () => void]>([
      [
        'the skill is still listed',
        () => vi.mocked(listSkillPacks).mockResolvedValue([LANDSCAPE, PORTRAIT])
      ],
      [
        'the list cannot be refreshed',
        () =>
          vi
            .mocked(listSkillPacks)
            .mockRejectedValue(new SkillPacksApiError('Server error', 500))
      ]
    ])(
      'keeps the draft changes after a 404 when %s',
      async ([, arrangeRefresh]) => {
        seedDraft(
          { kind: 'edit', name: 'landscape' },
          { ...DRAFT, name: 'landscape' }
        )
        vi.mocked(deleteSkillPack).mockRejectedValueOnce(
          new SkillPacksApiError('missing', 404)
        )
        const { user } = mount()
        await chooseDelete(user, 'landscape')
        arrangeRefresh()

        await confirmDeletion()

        expect(useSkillDraftStore().editDraftFor('landscape')).toBeDefined()
      }
    )

    it.for([
      ['changes', false],
      ['changes and changes back', true]
    ] as const)(
      'keeps the draft changes after a 404 when the workspace %s during the refresh',
      async ([, changesBack]) => {
        const workspace = useTeamWorkspaceStore()
        const shownWorkspaceId = workspace.workspaceId
        seedDraft(
          { kind: 'edit', name: 'landscape' },
          { ...DRAFT, name: 'landscape' }
        )
        vi.mocked(deleteSkillPack).mockRejectedValueOnce(
          new SkillPacksApiError('missing', 404)
        )
        const { user } = mount()
        await chooseDelete(user, 'landscape')
        vi.mocked(listSkillPacks).mockImplementation(async () => {
          Object.assign(workspace, { workspaceId: 'workspace-b' })
          if (changesBack)
            Object.assign(workspace, { workspaceId: shownWorkspaceId })
          return [LANDSCAPE, PORTRAIT]
        })

        await confirmDeletion()

        Object.assign(workspace, { workspaceId: shownWorkspaceId })
        expect(useSkillDraftStore().editDraftFor('landscape')).toBeDefined()
      }
    )

    it('keeps the draft changes of the skill when the workspace changed while the question was open', async () => {
      const workspace = useTeamWorkspaceStore()
      const shownWorkspaceId = workspace.workspaceId
      seedDraft(
        { kind: 'edit', name: 'landscape' },
        { ...DRAFT, name: 'landscape' }
      )
      const { user } = mount()
      await chooseDelete(user, 'landscape')

      Object.assign(workspace, { workspaceId: 'workspace-b' })
      seedDraft(
        { kind: 'edit', name: 'landscape' },
        { ...DRAFT, name: 'landscape', body: 'Workspace B text' }
      )
      await confirmDeletion()

      expect(deleteSkillPack).not.toHaveBeenCalled()
      expect(useSkillDraftStore().editDraftFor('landscape')?.body).toBe(
        'Workspace B text'
      )
      Object.assign(workspace, { workspaceId: shownWorkspaceId })
      expect(useSkillDraftStore().editDraftFor('landscape')).toBeDefined()
    })

    it('reports the failure in an error toast, keeps the skill and returns its row to normal', async () => {
      const deletion = pendingDelete()
      const { user } = mount()
      await chooseDelete(user, 'landscape')
      const confirmed = confirmDeletion()

      deletion.reject(new SkillPacksApiError('The server is busy', 503))
      await confirmed

      expect(useToast().toasts).toEqual([
        expect.objectContaining({
          kind: 'error',
          description: 'The server is busy'
        })
      ])
      const landscape = screen.getByRole('button', { name: 'landscape' })
      expect(landscape).toBeEnabled()
      expect(landscape).not.toHaveAttribute('aria-busy')
      expect(
        screen.getByRole('button', { name: 'Options for landscape' })
      ).toBeEnabled()
      expect(screen.getByRole('button', { name: 'portrait' })).toBeEnabled()
      await waitFor(() => expect(landscape).toHaveFocus())
    })
  })

  describe('discarding drafts', () => {
    function confirmDiscard() {
      const onConfirm = capturedOptions().footerProps?.onConfirm
      assert(typeof onConfirm === 'function')
      return onConfirm()
    }

    function cancelDiscard() {
      const onCancel = capturedOptions().footerProps?.onCancel
      assert(typeof onCancel === 'function')
      return onCancel()
    }

    it('asks before discarding a new-skill draft and keeps it when cancelled', async () => {
      seedDraft({ kind: 'new' })
      const { user } = mount()
      await user.click(
        screen.getByRole('button', { name: 'Options for sunset' })
      )
      await user.click(
        await screen.findByRole('menuitem', { name: 'Discard draft' })
      )

      expect(capturedOptions().headerProps?.title).toBe('Discard draft?')
      await cancelDiscard()

      expect(mockCloseDialog).toHaveBeenCalledExactlyOnceWith(DIALOG_HANDLE)
      expect(screen.getByRole('button', { name: 'sunset' })).toBeVisible()
    })

    it('removes a new-skill draft once discarding is confirmed', async () => {
      seedDraft({ kind: 'new' })
      const { user } = mount()
      await user.click(
        screen.getByRole('button', { name: 'Options for sunset' })
      )
      await user.click(
        await screen.findByRole('menuitem', { name: 'Discard draft' })
      )

      await confirmDiscard()

      expect(screen.queryByRole('button', { name: 'sunset' })).toBeNull()
      expect(useSkillDraftStore().newSkillDraft).toBeNull()
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add skill' })).toHaveFocus()
      )
    })

    it('discards the draft changes of a skill from its row menu and keeps the skill', async () => {
      seedDraft(
        { kind: 'edit', name: 'landscape' },
        { ...DRAFT, name: 'landscape' }
      )
      const { user } = mount()
      expect(screen.getByText('Draft changes')).toBeVisible()
      await user.click(
        screen.getByRole('button', { name: 'Options for landscape' })
      )
      await user.click(
        await screen.findByRole('menuitem', { name: 'Discard draft changes' })
      )

      await confirmDiscard()

      expect(screen.queryByText('Draft changes')).toBeNull()
      expect(screen.getByRole('button', { name: 'landscape' })).toBeVisible()
    })

    it('discards the draft of the workspace it was shown for, even if the workspace changed while the question was open', async () => {
      const workspace = useTeamWorkspaceStore()
      const shownWorkspaceId = workspace.workspaceId
      seedDraft({ kind: 'new' })
      const { user } = mount()
      await user.click(
        screen.getByRole('button', { name: 'Options for sunset' })
      )
      await user.click(
        await screen.findByRole('menuitem', { name: 'Discard draft' })
      )

      Object.assign(workspace, { workspaceId: 'workspace-b' })
      seedDraft({ kind: 'new' }, { ...DRAFT, name: 'bravo' })
      await confirmDiscard()

      expect(useSkillDraftStore().newSkillDraft?.name).toBe('bravo')
      Object.assign(workspace, { workspaceId: shownWorkspaceId })
      expect(useSkillDraftStore().newSkillDraft).toBeNull()
    })

    it('keeps the draft changes of a skill whose delete failed while the workspace changed', async () => {
      const workspace = useTeamWorkspaceStore()
      const shownWorkspaceId = workspace.workspaceId
      seedDraft(
        { kind: 'edit', name: 'landscape' },
        { ...DRAFT, name: 'landscape' }
      )
      vi.mocked(deleteSkillPack).mockImplementationOnce(async () => {
        Object.assign(workspace, { workspaceId: 'workspace-b' })
        throw new SkillPacksApiError('Server error', 500)
      })
      const { user } = mount()
      await chooseDelete(user, 'landscape')

      await confirmDeletion()

      Object.assign(workspace, { workspaceId: shownWorkspaceId })
      expect(useSkillDraftStore().editDraftFor('landscape')).toBeDefined()
    })

    it('offers no draft menu item on a skill without draft changes', async () => {
      const { user } = mount()

      await user.click(
        screen.getByRole('button', { name: 'Options for landscape' })
      )

      expect(
        await screen.findByRole('menuitem', { name: 'Delete' })
      ).toBeVisible()
      expect(
        screen.queryByRole('menuitem', { name: 'Discard draft changes' })
      ).toBeNull()
    })

    it('drops the draft changes of a skill when the skill is deleted', async () => {
      seedDraft(
        { kind: 'edit', name: 'landscape' },
        { ...DRAFT, name: 'landscape' }
      )
      const { user } = mount()
      await chooseDelete(user, 'landscape')

      await confirmDeletion()

      expect(useSkillDraftStore().editDraftFor('landscape')).toBeUndefined()
    })
  })
})
