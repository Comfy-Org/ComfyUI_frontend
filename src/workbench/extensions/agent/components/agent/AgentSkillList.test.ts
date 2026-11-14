import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'
import {
  listSkillPacks,
  SkillPacksApiError
} from '@/platform/skills/api/skillsApi'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillPack } from '@/platform/skills/types'

import AgentSkillList from './AgentSkillList.vue'

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

const PORTRAIT = pack('portrait', 'Compose a portrait', 'x'.repeat(10))
const LANDSCAPE = pack('landscape', 'Compose a landscape')

function seedCatalog(packs: SkillPack[]) {
  const skills = useSkillPacksStore()
  skills.flagsEnabled = true
  skills.hasLoaded = true
  skills.catalogConfirmed = true
  skills.packs = packs
  vi.mocked(listSkillPacks).mockResolvedValue(packs)
  return skills
}

function forgetCatalog() {
  const skills = seedCatalog([])
  skills.hasLoaded = false
  skills.catalogConfirmed = false
  return skills
}

function pendingListing() {
  let resolve: (packs: SkillPack[]) => void = () => {}
  vi.mocked(listSkillPacks).mockReturnValueOnce(
    new Promise<SkillPack[]>((settle) => {
      resolve = settle
    })
  )
  return (packs: SkillPack[]) => resolve(packs)
}

function mount(props: ComponentProps<typeof AgentSkillList> = {}) {
  return render(AgentSkillList, { props, global: { plugins: [i18n] } })
}

describe('AgentSkillList', () => {
  beforeEach(() => {
    vi.mocked(listSkillPacks).mockResolvedValue([])
  })

  it('shows each skill with its description and size, in the store order', async () => {
    seedCatalog([LANDSCAPE, PORTRAIT])
    vi.mocked(listSkillPacks).mockResolvedValue([LANDSCAPE, PORTRAIT])
    mount()

    const rows = screen.getAllByRole('listitem')

    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent(/^landscape/)
    expect(within(rows[0]).getByText('Compose a landscape')).toBeVisible()
    expect(rows[1]).toHaveTextContent(/^portrait/)
    expect(within(rows[1]).getByText('Compose a portrait')).toBeVisible()
    expect(within(rows[1]).getByText('28 bytes')).toBeVisible()
  })

  it('says it is loading, never that there are no skills, until the first listing arrives', async () => {
    const resolve = pendingListing()
    forgetCatalog()
    mount()

    expect(screen.getByRole('status')).toHaveTextContent('Loading skills')
    expect(screen.queryByText('No skills yet')).toBeNull()
    expect(screen.queryByRole('listitem')).toBeNull()

    resolve([PORTRAIT])

    expect(await screen.findByText('portrait')).toBeVisible()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows the cached skills at once and updates them in place when the refresh arrives', async () => {
    const resolve = pendingListing()
    seedCatalog([LANDSCAPE])
    mount()

    expect(screen.getByText('landscape')).toBeVisible()
    expect(screen.queryByRole('status')).toBeNull()

    resolve([LANDSCAPE, PORTRAIT])

    expect(await screen.findByText('portrait')).toBeVisible()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('keeps the cached skills when the refresh fails', async () => {
    vi.mocked(listSkillPacks).mockRejectedValueOnce(
      new SkillPacksApiError('unavailable', 503)
    )
    const skills = seedCatalog([LANDSCAPE])
    mount()

    await waitFor(() => expect(skills.loadFailed).toBe(true))

    expect(screen.getByText('landscape')).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('invites the first skill when the confirmed list is empty, also while it refreshes', async () => {
    const resolve = pendingListing()
    const skills = seedCatalog([])
    mount()

    expect(screen.getByText('No skills yet')).toBeVisible()
    expect(
      screen.getByText(
        'Add one to teach the agent a preference you keep repeating.'
      )
    ).toBeVisible()

    resolve([])
    await waitFor(() => expect(skills.loading).toBe(false))

    expect(screen.getByText('No skills yet')).toBeVisible()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('offers a retry instead of an empty state when the first load failed', async () => {
    vi.mocked(listSkillPacks).mockRejectedValueOnce(
      new SkillPacksApiError('unavailable', 503)
    )
    forgetCatalog()
    mount()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load skills. Try again.'
    )
    expect(screen.queryByText('No skills yet')).toBeNull()

    vi.mocked(listSkillPacks).mockResolvedValueOnce([PORTRAIT])
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('portrait')).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the error after a failed retry', async () => {
    vi.mocked(listSkillPacks)
      .mockRejectedValueOnce(new SkillPacksApiError('unavailable', 503))
      .mockRejectedValueOnce(new SkillPacksApiError('unavailable', 503))
    const skills = forgetCatalog()
    mount()
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(listSkillPacks).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(skills.loadFailed).toBe(true))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load skills. Try again.'
    )
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
    expect(screen.queryByText('No skills yet')).toBeNull()
  })

  it('says skills are unavailable, and drops the stale list, when the routes answer 404', async () => {
    vi.mocked(listSkillPacks).mockRejectedValueOnce(
      new SkillPacksApiError('missing', 404)
    )
    seedCatalog([LANDSCAPE])
    mount()

    expect(
      await screen.findByText("Skills aren't available right now.")
    ).toBeVisible()
    expect(screen.queryByText('landscape')).toBeNull()
    expect(screen.getByRole('button', { name: 'Back to chat' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Add skill' })).toBeNull()
  })

  it('does not ask the server when skills are not enabled', () => {
    useSkillPacksStore().flagsEnabled = false
    mount()

    expect(screen.getByText("Skills aren't available right now.")).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Add skill' })).toBeNull()
    expect(listSkillPacks).not.toHaveBeenCalled()
  })

  it('asks to add a skill from the header once the list is known', async () => {
    seedCatalog([LANDSCAPE])
    const { emitted } = mount()

    await userEvent.click(screen.getByRole('button', { name: 'Add skill' }))

    expect(emitted().add).toHaveLength(1)
  })

  it('invites the first skill from the empty state, besides the header', async () => {
    seedCatalog([])
    const { emitted } = mount()
    const addButtons = screen.getAllByRole('button', { name: 'Add skill' })

    expect(addButtons).toHaveLength(2)
    await userEvent.click(addButtons[0])
    await userEvent.click(addButtons[1])

    expect(emitted().add).toHaveLength(2)
  })

  it('keeps Add disabled while the first listing is still loading', () => {
    pendingListing()
    forgetCatalog()
    mount()

    expect(screen.getByRole('button', { name: 'Add skill' })).toBeDisabled()
  })

  it('keeps Add disabled when the first load failed', async () => {
    vi.mocked(listSkillPacks).mockRejectedValueOnce(
      new SkillPacksApiError('unavailable', 503)
    )
    forgetCatalog()
    mount()
    await screen.findByRole('alert')

    expect(screen.getByRole('button', { name: 'Add skill' })).toBeDisabled()
  })

  it('opens a skill for editing when its row is clicked', async () => {
    seedCatalog([LANDSCAPE, PORTRAIT])
    const { emitted } = mount()

    await userEvent.click(screen.getByRole('button', { name: 'portrait' }))

    expect(emitted().edit).toEqual([[PORTRAIT]])
  })

  it('describes each row by the skill description', () => {
    seedCatalog([LANDSCAPE])
    mount()

    expect(
      screen.getByRole('button', { name: 'landscape' })
    ).toHaveAccessibleDescription('Compose a landscape')
  })

  it.for([
    { initialFocus: 'add', focused: 'Add skill' },
    { initialFocus: { pack: 'portrait' }, focused: 'portrait' }
  ] as const)(
    'puts focus on $focused when the screen is asked to',
    async ({ initialFocus, focused }) => {
      seedCatalog([LANDSCAPE, PORTRAIT])
      mount({ initialFocus })

      await waitFor(() =>
        expect(screen.getByRole('button', { name: focused })).toHaveFocus()
      )
    }
  )

  it('opens with focus on Back, which leaves the screen', async () => {
    seedCatalog([LANDSCAPE])
    const { emitted } = mount()
    const back = screen.getByRole('button', { name: 'Back to chat' })

    await waitFor(() => expect(back).toHaveFocus())
    await userEvent.click(back)

    expect(emitted().back).toHaveLength(1)
  })
})
