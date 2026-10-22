import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as profiles from '@/lib/cms/profile-client'
import AuthorPicker from './AuthorPicker.vue'

const choice = {
  id: 'fPc7irbKt2VLbuIkRrWuC5TH5lX2',
  label: 'Profile fixture',
  username: 'profile-fixture',
  avatar_url: 'https://example.org/avatar.png'
}
beforeEach(() => {
  vi.spyOn(profiles, 'searchProfiles').mockResolvedValue({
    ok: true,
    items: [choice]
  })
})

describe('account author picker', () => {
  it('shows names/avatars but only changes the canonical ID after explicit selection', async () => {
    const user = userEvent.setup()
    const view = render(AuthorPicker, { props: { modelValue: '' } })
    await user.type(screen.getByRole('combobox', { name: 'Author' }), 'Profile')
    const option = await screen.findByRole('option', {
      name: 'Profile fixture profile-fixture'
    })
    expect(view.emitted('update:modelValue')).toBeUndefined()
    expect(screen.getByAltText('')).toHaveAttribute('src', choice.avatar_url)
    await user.click(option)
    expect(view.emitted('update:modelValue')).toEqual([[choice.id]])
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
  it('resolves the existing canonical author without rewriting it or exposing an owner control', async () => {
    const view = render(AuthorPicker, { props: { modelValue: choice.id } })
    expect(await screen.findByText('Profile fixture')).toBeVisible()
    expect(view.emitted('update:modelValue')).toBeUndefined()
    expect(screen.queryByLabelText('Owner')).not.toBeInTheDocument()
  })
  it('selects via Enter and never submits its containing form', async () => {
    const user = userEvent.setup()
    const submit = vi.fn()
    const choose = vi.fn()
    render({
      components: { AuthorPicker },
      template:
        '<form @submit.prevent="submit"><AuthorPicker model-value="" @update:model-value="choose" /></form>',
      setup: () => ({ submit, choose })
    })
    await user.type(screen.getByRole('combobox', { name: 'Author' }), 'Profile')
    await screen.findByRole('option')
    await user.keyboard('{Enter}')
    expect(submit).not.toHaveBeenCalled()
    expect(choose).toHaveBeenCalledWith(choice.id)
  })
  it('keeps the selected ID on lookup failure and honors disabled controls', async () => {
    vi.mocked(profiles.searchProfiles).mockResolvedValue({ ok: false })
    const user = userEvent.setup()
    const view = render(AuthorPicker, { props: { modelValue: choice.id } })
    await user.type(screen.getByRole('combobox', { name: 'Author' }), 'Missing')
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Profile lookup is unavailable'
      )
    )
    expect(view.emitted('update:modelValue')).toBeUndefined()
    await view.rerender({ disabled: true })
    expect(screen.getByRole('combobox', { name: 'Author' })).toBeDisabled()
  })
  it('cancels stale search results so they cannot select the wrong account', async () => {
    let complete:
      | ((value: Awaited<ReturnType<typeof profiles.searchProfiles>>) => void)
      | undefined
    vi.mocked(profiles.searchProfiles).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    const user = userEvent.setup()
    const view = render(AuthorPicker, { props: { modelValue: '' } })
    const input = screen.getByRole('combobox', { name: 'Author' })
    await user.type(input, 'First')
    await waitFor(() => expect(complete).toBeTypeOf('function'))
    await user.clear(input)
    await user.type(input, 'Second')
    await screen.findByRole('option')
    complete?.({
      ok: true,
      items: [{ ...choice, id: 'different-account', label: 'Stale result' }]
    })
    await waitFor(() =>
      expect(screen.queryByText('Stale result')).not.toBeInTheDocument()
    )
    expect(view.emitted('update:modelValue')).toBeUndefined()
  })
})
