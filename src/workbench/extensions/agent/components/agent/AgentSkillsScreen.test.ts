import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import {
  listSkillPacks,
  publishSkillPack,
  SkillPacksApiError
} from '@/platform/skills/api/skillsApi'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillPack } from '@/platform/skills/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import AgentSkillsScreen from './AgentSkillsScreen.vue'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/skills/api/skillsApi'), { spy: true })

function pack(name: string, description: string, body = 'Instructions') {
  return {
    id: name,
    name,
    description,
    body,
    body_hash: 'hash',
    created_at: '2026-10-06T00:00:00Z',
    updated_at: '2026-10-06T00:00:00Z'
  } satisfies SkillPack
}

const LANDSCAPE = pack('landscape', 'Compose a landscape')
const PORTRAIT = pack(
  'portrait',
  'Compose a portrait',
  'Keep the subject sharp'
)

function seedCatalog(packs: SkillPack[]) {
  const skills = useSkillPacksStore()
  skills.flagsEnabled = true
  skills.hasLoaded = true
  skills.catalogConfirmed = true
  skills.packs = packs
  vi.mocked(listSkillPacks).mockResolvedValue(packs)
  return skills
}

function serverHolds(packs: SkillPack[]) {
  vi.mocked(listSkillPacks).mockResolvedValue(packs)
}

function mount() {
  const user = userEvent.setup()
  const view = render(AgentSkillsScreen, { global: { plugins: [i18n] } })
  return { ...view, user }
}

type User = ReturnType<typeof userEvent.setup>

async function fillField(user: User, label: string, text: string) {
  await user.click(screen.getByRole('textbox', { name: label }))
  await user.paste(text)
}

async function openAddForm(user: User) {
  await user.click(screen.getAllByRole('button', { name: 'Add skill' })[0])
  await screen.findByRole('heading', { name: 'Add skill' })
}

async function openEditForm(user: User, name: string) {
  await user.click(screen.getByRole('button', { name }))
  await screen.findByRole('heading', { name: 'Edit skill' })
}

function openLandscapeForm(user: User) {
  return openEditForm(user, 'landscape')
}

function pendingSave() {
  let settle: {
    resolve: (saved: SkillPack) => void
    reject: (e: Error) => void
  }
  vi.mocked(publishSkillPack).mockReturnValueOnce(
    new Promise<SkillPack>((resolve, reject) => {
      settle = { resolve, reject }
    })
  )
  return {
    resolve: (saved: SkillPack) => settle.resolve(saved),
    reject: (error: Error) => settle.reject(error)
  }
}

describe('AgentSkillsScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    seedCatalog([LANDSCAPE])
  })

  describe('adding a skill', () => {
    it('opens an empty form in place of the list with focus in Name', async () => {
      const { user } = mount()

      await openAddForm(user)

      const name = screen.getByRole('textbox', { name: 'Name' })
      expect(name).toHaveValue('')
      expect(screen.getByRole('textbox', { name: 'When to use' })).toHaveValue(
        ''
      )
      expect(screen.getByRole('textbox', { name: 'Instructions' })).toHaveValue(
        ''
      )
      expect(screen.queryByRole('list')).toBeNull()
      await waitFor(() => expect(name).toHaveFocus())
    })

    it('tabs through Name, When to use, Instructions, Cancel and Save', async () => {
      const { user } = mount()
      await openAddForm(user)
      await waitFor(() =>
        expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()
      )

      await user.tab()
      expect(screen.getByRole('textbox', { name: 'When to use' })).toHaveFocus()
      await user.tab()
      expect(
        screen.getByRole('textbox', { name: 'Instructions' })
      ).toHaveFocus()
      await user.tab()
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
      await user.tab()
      expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
    })

    it('saves with one request, returns to the list with the skill in its sorted place and focuses its row', async () => {
      vi.mocked(publishSkillPack).mockResolvedValue(PORTRAIT)
      const { user } = mount()
      await openAddForm(user)
      serverHolds([LANDSCAPE, PORTRAIT])

      await fillField(user, 'Name', ' portrait ')
      await fillField(user, 'When to use', 'Compose a portrait')
      await fillField(user, 'Instructions', 'Keep the subject sharp')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      const row = await screen.findByRole('button', { name: 'portrait' })
      expect(publishSkillPack).toHaveBeenCalledExactlyOnceWith({
        name: 'portrait',
        description: 'Compose a portrait',
        body: 'Keep the subject sharp'
      })
      const rows = screen.getAllByRole('listitem')
      expect(rows[0]).toHaveTextContent(/^landscape/)
      expect(rows[1]).toHaveTextContent(/^portrait/)
      expect(screen.queryByRole('textbox')).toBeNull()
      await waitFor(() => expect(row).toHaveFocus())
    })

    it('shows progress, locks the form and ignores another save while the request is pending', async () => {
      const save = pendingSave()
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'Name', 'portrait')
      await fillField(user, 'When to use', 'Compose a portrait')
      await fillField(user, 'Instructions', 'Keep the subject sharp')

      serverHolds([LANDSCAPE, PORTRAIT])
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute(
        'aria-busy',
        'true'
      )
      expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled()
      expect(
        screen.getByRole('textbox', { name: 'When to use' })
      ).toBeDisabled()
      expect(
        screen.getByRole('textbox', { name: 'Instructions' })
      ).toBeDisabled()
      expect(
        screen.getByRole('button', { name: 'Back to skills' })
      ).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(publishSkillPack).toHaveBeenCalledOnce()

      save.resolve(PORTRAIT)

      expect(
        await screen.findByRole('button', { name: 'portrait' })
      ).toBeVisible()
    })

    it('saves from Enter in a single-line field, while Enter in Instructions only adds a line', async () => {
      vi.mocked(publishSkillPack).mockResolvedValue(PORTRAIT)
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'Name', 'portrait')
      await fillField(user, 'When to use', 'Compose a portrait')
      await fillField(user, 'Instructions', 'Keep the subject sharp')

      await user.type(
        screen.getByRole('textbox', { name: 'Instructions' }),
        '{Enter}'
      )

      expect(publishSkillPack).not.toHaveBeenCalled()
      expect(screen.getByRole('textbox', { name: 'Instructions' })).toHaveValue(
        'Keep the subject sharp\n'
      )

      await user.type(screen.getByRole('textbox', { name: 'Name' }), '{Enter}')

      expect(publishSkillPack).toHaveBeenCalledOnce()
    })

    it.for([
      ['Instructions', 'Control'],
      ['Instructions', 'Meta'],
      ['Name', 'Control'],
      ['When to use', 'Meta']
    ])(
      'keeps Enter with %s held down in %s from reaching the app-wide shortcuts that run the workflow',
      async ([field, modifier]) => {
        const appWideShortcuts = vi.fn()
        window.addEventListener('keydown', appWideShortcuts)
        const { user } = mount()
        await openAddForm(user)
        await user.click(screen.getByRole('textbox', { name: field }))

        await user.keyboard(`{${modifier}>}{Enter}{/${modifier}}`)

        const enterPresses = appWideShortcuts.mock.calls.filter(
          ([event]) => event.key === 'Enter'
        )
        window.removeEventListener('keydown', appWideShortcuts)
        expect(enterPresses).toEqual([])
      }
    )

    it('shows When to use in a field that wraps long text over several lines', async () => {
      const { user } = mount()

      await openAddForm(user)

      expect(
        screen.getByRole('textbox', { name: 'When to use' })
      ).toBeInstanceOf(HTMLTextAreaElement)
    })

    it('saves from Enter in When to use without adding a line break', async () => {
      const save = pendingSave()
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'Name', 'portrait')
      await fillField(user, 'When to use', 'Compose a portrait')
      await fillField(user, 'Instructions', 'Keep the subject sharp')
      const whenToUse = screen.getByRole('textbox', { name: 'When to use' })

      await user.type(whenToUse, '{Enter}')

      expect(publishSkillPack).toHaveBeenCalledWith({
        name: 'portrait',
        description: 'Compose a portrait',
        body: 'Keep the subject sharp'
      })
      expect(whenToUse).toHaveValue('Compose a portrait')

      save.resolve(PORTRAIT)
    })

    it('adds no line break when Enter in When to use is refused by validation', async () => {
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'Name', 'portrait')
      await fillField(user, 'When to use', 'Compose a portrait')
      const whenToUse = screen.getByRole('textbox', { name: 'When to use' })

      await user.type(whenToUse, '{Enter}')

      expect(publishSkillPack).not.toHaveBeenCalled()
      expect(
        screen.getByRole('textbox', { name: 'Instructions' })
      ).toHaveAccessibleDescription('Instructions are required')
      expect(whenToUse).toHaveValue('Compose a portrait')
    })

    it('turns line breaks in pasted text into spaces in When to use', async () => {
      const { user } = mount()
      await openAddForm(user)

      await fillField(
        user,
        'When to use',
        '\nCompose a\nportrait\n\nwith a flash\n'
      )

      await waitFor(() =>
        expect(
          screen.getByRole('textbox', { name: 'When to use' })
        ).toHaveValue('Compose a portrait with a flash')
      )
    })

    it.for([
      ['a tab', 'Compose a\tportrait'],
      ['a line separator', 'Compose a\u2028portrait'],
      ['a next-line character', 'Compose a\u0085portrait']
    ])(
      'turns %s in pasted text into a space in When to use',
      async ([, pasted]) => {
        const { user } = mount()
        await openAddForm(user)

        await fillField(user, 'When to use', pasted)

        await waitFor(() =>
          expect(
            screen.getByRole('textbox', { name: 'When to use' })
          ).toHaveValue('Compose a portrait')
        )
      }
    )
  })

  describe('refusing a save', () => {
    it.for([
      ['Name', '', 'load me', 'do it', 'Name is required'],
      ['When to use', 'my-skill', '', 'do it', 'When to use is required'],
      ['Instructions', 'my-skill', 'load me', '', 'Instructions are required'],
      [
        'When to use',
        'my-skill',
        '😀'.repeat(1025),
        'do it',
        'When to use must be 1024 characters or less'
      ],
      [
        'Name',
        'landscape',
        'load me',
        'do it',
        'A skill named "landscape" already exists. Edit that skill instead.'
      ]
    ])(
      'sends nothing and moves focus to %s when it is invalid: %s',
      async ([label, name, description, body, message]) => {
        const { user } = mount()
        await openAddForm(user)
        await fillField(user, 'Name', name)
        await fillField(user, 'When to use', description)
        await fillField(user, 'Instructions', body)

        await user.click(screen.getByRole('button', { name: 'Save' }))

        const input = screen.getByRole('textbox', { name: label })
        expect(input).toHaveAttribute('aria-invalid', 'true')
        expect(input).toHaveAccessibleDescription(message)
        expect(screen.getByRole('alert')).toHaveTextContent(message)
        await waitFor(() => expect(input).toHaveFocus())
        expect(publishSkillPack).not.toHaveBeenCalled()
        expect(
          screen.getByRole('textbox', { name: 'Instructions' })
        ).toHaveValue(body)
      }
    )

    it('shows the server message on one line, keeps the input and allows another try', async () => {
      vi.mocked(publishSkillPack).mockRejectedValueOnce(
        new SkillPacksApiError('Instructions are too long', 400)
      )
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'Name', 'portrait')
      await fillField(user, 'When to use', 'Compose a portrait')
      await fillField(user, 'Instructions', 'Keep the subject sharp')

      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Instructions are too long'
      )
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
        'portrait'
      )
      expect(screen.getByRole('textbox', { name: 'Instructions' })).toHaveValue(
        'Keep the subject sharp'
      )
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

      vi.mocked(publishSkillPack).mockResolvedValueOnce(PORTRAIT)
      serverHolds([LANDSCAPE, PORTRAIT])
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(
        await screen.findByRole('button', { name: 'portrait' })
      ).toBeVisible()
    })

    it('puts focus back on Save after a refusal, though the browser dropped it while the form was locked', async () => {
      const save = pendingSave()
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'Name', 'portrait')
      await fillField(user, 'When to use', 'Compose a portrait')
      await fillField(user, 'Instructions', 'Keep the subject sharp')
      await user.click(screen.getByRole('button', { name: 'Save' }))
      document.body.focus()

      save.reject(new SkillPacksApiError('Instructions are too long', 400))

      await screen.findByRole('alert')
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
      )
    })

    it('explains the limit with the server message and keeps the input', async () => {
      vi.mocked(publishSkillPack).mockRejectedValueOnce(
        new SkillPacksApiError('5 skills is the most you can keep', 409)
      )
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'Name', 'portrait')
      await fillField(user, 'When to use', 'Compose a portrait')
      await fillField(user, 'Instructions', 'Keep the subject sharp')

      await user.click(screen.getByRole('button', { name: 'Save' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('You are at your limit')
      expect(alert).toHaveTextContent('5 skills is the most you can keep')
      expect(alert).toHaveTextContent(
        'Remove a skill to make room for this one.'
      )
      expect(screen.getByRole('textbox', { name: 'Instructions' })).toHaveValue(
        'Keep the subject sharp'
      )
    })

    it('says skills are unavailable and closes the form when the routes answer 404', async () => {
      vi.mocked(publishSkillPack).mockRejectedValueOnce(
        new SkillPacksApiError('missing', 404)
      )
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'Name', 'portrait')
      await fillField(user, 'When to use', 'Compose a portrait')
      await fillField(user, 'Instructions', 'Keep the subject sharp')

      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(
        await screen.findByText("Skills aren't available right now.")
      ).toBeVisible()
      expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('closes an open form without saving when the workspace changes', async () => {
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'Name', 'portrait')

      Object.assign(useTeamWorkspaceStore(), { workspaceId: 'workspace-b' })

      await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
      expect(publishSkillPack).not.toHaveBeenCalled()
      expect(screen.queryByText('portrait')).toBeNull()
    })
  })

  describe('editing a skill', () => {
    it('opens the form filled from the row, with the name locked and explained', async () => {
      const { user } = mount()
      await waitFor(() => expect(listSkillPacks).toHaveBeenCalledOnce())

      await openEditForm(user, 'landscape')

      const name = screen.getByRole('textbox', { name: 'Name' })
      expect(name).toHaveValue('landscape')
      expect(name).toBeDisabled()
      expect(name).toHaveAccessibleDescription(
        "The name can't be changed. To rename, delete this skill and add it again."
      )
      expect(screen.getByRole('textbox', { name: 'When to use' })).toHaveValue(
        'Compose a landscape'
      )
      expect(screen.getByRole('textbox', { name: 'Instructions' })).toHaveValue(
        'Instructions'
      )
      expect(listSkillPacks).toHaveBeenCalledOnce()
    })

    it('saves the changes under the same name and shows them on the list', async () => {
      const updated = { ...LANDSCAPE, description: 'Compose a wide landscape' }
      vi.mocked(publishSkillPack).mockResolvedValue(updated)
      const { user } = mount()
      await openEditForm(user, 'landscape')
      serverHolds([updated])

      await user.clear(screen.getByRole('textbox', { name: 'When to use' }))
      await fillField(user, 'When to use', 'Compose a wide landscape')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByText('Compose a wide landscape')).toBeVisible()
      expect(publishSkillPack).toHaveBeenCalledExactlyOnceWith({
        name: 'landscape',
        description: 'Compose a wide landscape',
        body: 'Instructions'
      })
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'landscape' })).toHaveFocus()
      )
    })
  })

  describe('leaving the form', () => {
    it.for([
      {
        form: 'Edit',
        open: openLandscapeForm,
        leave: 'Back to skills',
        focused: 'landscape'
      },
      {
        form: 'Edit',
        open: openLandscapeForm,
        leave: 'Cancel',
        focused: 'landscape'
      },
      {
        form: 'Add',
        open: openAddForm,
        leave: 'Back to skills',
        focused: 'Add skill'
      },
      { form: 'Add', open: openAddForm, leave: 'Cancel', focused: 'Add skill' }
    ])(
      'returns at once from the $form form with nothing changed, via $leave, and focuses $focused',
      async ({ open, leave, focused }) => {
        const { user } = mount()
        await open(user)

        await user.click(screen.getByRole('button', { name: leave }))

        expect(await screen.findByRole('list')).toBeVisible()
        expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
        await waitFor(() =>
          expect(
            screen.getAllByRole('button', { name: focused })[0]
          ).toHaveFocus()
        )
      }
    )

    it.for(['Back to skills', 'Cancel'])(
      'closes at once and keeps typed changes as a draft via %s',
      async (leave) => {
        const { user } = mount()
        await openAddForm(user)
        await fillField(user, 'Name', 'portrait')

        await user.click(screen.getByRole('button', { name: leave }))

        expect(
          await screen.findByRole('list', { name: 'Skills' })
        ).toBeVisible()
        expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
        expect(publishSkillPack).not.toHaveBeenCalled()
        expect(
          screen.getByRole('button', { name: 'portrait' })
        ).toHaveAccessibleDescription('Draft · saved on this device only')
      }
    )

    it('names a draft without a name Untitled skill', async () => {
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'When to use', 'Compose a portrait')

      await user.click(screen.getByRole('button', { name: 'Back to skills' }))

      expect(
        await screen.findByRole('button', { name: 'Untitled skill' })
      ).toBeVisible()
    })

    it('reopens a draft from its row with every field restored', async () => {
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'Name', 'portrait')
      await fillField(user, 'When to use', 'Compose a portrait')
      await fillField(user, 'Instructions', 'Keep the subject sharp')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      await user.click(await screen.findByRole('button', { name: 'portrait' }))

      await screen.findByRole('heading', { name: 'Add skill' })
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
        'portrait'
      )
      expect(screen.getByRole('textbox', { name: 'When to use' })).toHaveValue(
        'Compose a portrait'
      )
      expect(screen.getByRole('textbox', { name: 'Instructions' })).toHaveValue(
        'Keep the subject sharp'
      )
    })

    it('opens the saved draft when Add is pressed', async () => {
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'Name', 'portrait')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await screen.findByRole('list', { name: 'Skills' })

      await openAddForm(user)

      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
        'portrait'
      )
    })

    it('keeps no draft when nothing was typed', async () => {
      const { user } = mount()
      await openAddForm(user)

      await user.click(screen.getByRole('button', { name: 'Back to skills' }))

      expect(await screen.findByRole('list', { name: 'Skills' })).toBeVisible()
      expect(screen.queryByRole('list', { name: 'Drafts' })).toBeNull()
    })

    it('drops the draft when every field is emptied again', async () => {
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'Name', 'portrait')
      await user.clear(screen.getByRole('textbox', { name: 'Name' }))

      await user.click(screen.getByRole('button', { name: 'Back to skills' }))

      await screen.findByRole('list', { name: 'Skills' })
      expect(screen.queryByRole('list', { name: 'Drafts' })).toBeNull()
    })

    it('removes the draft once the save succeeds', async () => {
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'Name', 'portrait')
      await fillField(user, 'When to use', 'Compose a portrait')
      await fillField(user, 'Instructions', 'Keep the subject sharp')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await user.click(await screen.findByRole('button', { name: 'portrait' }))
      vi.mocked(publishSkillPack).mockResolvedValueOnce(PORTRAIT)

      await user.click(screen.getByRole('button', { name: 'Save' }))

      await screen.findByRole('list', { name: 'Skills' })
      expect(screen.queryByRole('list', { name: 'Drafts' })).toBeNull()
    })

    it('keeps the draft when the save fails', async () => {
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'Name', 'portrait')
      await fillField(user, 'When to use', 'Compose a portrait')
      await fillField(user, 'Instructions', 'Keep the subject sharp')
      vi.mocked(publishSkillPack).mockRejectedValueOnce(
        new SkillPacksApiError('The server is busy', 503)
      )
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await screen.findByText('The server is busy')

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(
        await screen.findByRole('button', { name: 'portrait' })
      ).toBeVisible()
    })

    it('marks an edited skill with its draft changes and restores them on Edit', async () => {
      const { user } = mount()
      await openEditForm(user, 'landscape')
      await fillField(user, 'When to use', ' and more')
      await user.click(screen.getByRole('button', { name: 'Back to skills' }))

      expect(await screen.findByText('Draft changes')).toBeVisible()
      await user.click(screen.getByRole('button', { name: 'landscape' }))

      await screen.findByRole('heading', { name: 'Edit skill' })
      expect(screen.getByRole('textbox', { name: 'When to use' })).toHaveValue(
        'Compose a landscape and more'
      )
      expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled()
    })

    it('drops the draft changes of a skill that is typed back to its saved text', async () => {
      const { user } = mount()
      await openEditForm(user, 'landscape')
      const whenToUse = screen.getByRole('textbox', { name: 'When to use' })
      await fillField(user, 'When to use', ' and more')
      await user.clear(whenToUse)
      await fillField(user, 'When to use', 'Compose a landscape')

      await user.click(screen.getByRole('button', { name: 'Back to skills' }))

      await screen.findByRole('list', { name: 'Skills' })
      expect(screen.queryByText('Draft changes')).toBeNull()
    })

    it('keeps a draft with the workspace it was typed in', async () => {
      const workspace = useTeamWorkspaceStore()
      const typedWorkspaceId = workspace.workspaceId
      const { user } = mount()
      await openAddForm(user)
      await fillField(user, 'Name', 'portrait')

      Object.assign(workspace, { workspaceId: 'workspace-b' })

      await screen.findByRole('list', { name: 'Skills' })
      expect(screen.queryByRole('list', { name: 'Drafts' })).toBeNull()
      Object.assign(workspace, { workspaceId: typedWorkspaceId })
      expect(
        await screen.findByRole('button', { name: 'portrait' })
      ).toBeVisible()
    })
  })
})
