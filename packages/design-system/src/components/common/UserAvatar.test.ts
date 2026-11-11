import type { ComponentProps } from 'vue-component-type-helpers'

import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import UserAvatar from './UserAvatar.vue'

describe('UserAvatar', () => {
  function renderComponent(
    props: Partial<ComponentProps<typeof UserAvatar>> = {}
  ) {
    return render(UserAvatar, {
      props: { label: 'User Avatar', ...props }
    })
  }

  it('renders correctly with photo Url', () => {
    renderComponent({
      photoUrl: 'https://example.com/avatar.jpg'
    })

    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg'
    )
    expect(screen.queryByTestId('avatar-icon')).not.toBeInTheDocument()
  })

  it('renders with default icon when no photo Url is provided', () => {
    renderComponent({
      photoUrl: undefined
    })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('avatar-icon')).toBeInTheDocument()
  })

  it('renders with default icon when provided photo Url is null', () => {
    renderComponent({
      photoUrl: null
    })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('avatar-icon')).toBeInTheDocument()
  })

  it('falls back on image error and retries when the photo URL changes', async () => {
    const { rerender } = renderComponent({
      photoUrl: 'https://example.com/broken-image.jpg'
    })

    const img = screen.getByRole('img')
    expect(screen.queryByTestId('avatar-icon')).not.toBeInTheDocument()

    await fireEvent.error(img)
    await nextTick()

    expect(screen.getByTestId('avatar-icon')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await rerender({ label: 'Updated label' })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await rerender({ photoUrl: 'https://example.com/replacement.jpg' })
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://example.com/replacement.jpg'
    )
    expect(screen.queryByTestId('avatar-icon')).not.toBeInTheDocument()

    await fireEvent.error(screen.getByRole('img'))
    expect(screen.getByTestId('avatar-icon')).toBeInTheDocument()
  })

  it('shows initials in place of the icon when there is no photo', () => {
    renderComponent({ initials: 'MM' })

    expect(screen.getByRole('img', { name: 'User Avatar' })).toHaveTextContent(
      'MM'
    )
    expect(screen.queryByTestId('avatar-icon')).not.toBeInTheDocument()
  })

  it('shows the photo instead of initials when a photo is available', () => {
    renderComponent({
      photoUrl: 'https://example.com/avatar.jpg',
      initials: 'MM'
    })

    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg'
    )
    expect(screen.queryByText('MM')).not.toBeInTheDocument()
  })

  it('shows initials after the photo fails to load', async () => {
    renderComponent({
      photoUrl: 'https://example.com/broken-image.jpg',
      initials: 'MM',
      label: 'Marwan Mostafa'
    })

    await fireEvent.error(screen.getByRole('img'))

    expect(
      screen.getByRole('img', { name: 'Marwan Mostafa' })
    ).toHaveTextContent('MM')
    expect(screen.queryByTestId('avatar-icon')).not.toBeInTheDocument()
  })

  it('renders the default icon when initials are empty', () => {
    renderComponent({ initials: '' })

    expect(screen.getByTestId('avatar-icon')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('uses provided label', () => {
    renderComponent({
      photoUrl: 'https://example.com/avatar.jpg',
      label: 'Custom Label'
    })

    expect(screen.getByLabelText('Custom Label')).toBeInTheDocument()
  })
})
