import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import ComfyHubCreateProfileForm from './ComfyHubCreateProfileForm.vue'
import type { ComponentProps } from 'vue-component-type-helpers'

const mockCreateProfile = vi.hoisted(() => vi.fn())
const mockToast = vi.hoisted(() => ({
  add: vi.fn()
}))
const mockIsFileTooLarge = vi.hoisted(() => vi.fn())

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

vi.mock('primevue/usetoast', () => ({
  useToast: () => mockToast
}))

vi.mock('@vueuse/core', async () => {
  const { computed } = await import('vue')
  return {
    useObjectUrl: (file: { value: File | null }) =>
      computed(() => (file.value ? `blob:${file.value.name}` : undefined))
  }
})

vi.mock(
  '@/platform/workflow/sharing/composables/useComfyHubProfileGate',
  () => ({
    useComfyHubProfileGate: () => ({
      createProfile: mockCreateProfile
    })
  })
)

vi.mock('@/platform/workflow/sharing/utils/validateFileSize', () => ({
  MAX_IMAGE_SIZE_MB: 10,
  isFileTooLarge: mockIsFileTooLarge
}))

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    props: ['disabled', 'ariaLabel'],
    emits: ['click'],
    template: `
      <button
        type="button"
        :disabled="disabled"
        :aria-label="ariaLabel"
        @click="$emit('click')"
      >
        <slot />
      </button>
    `
  }
}))

vi.mock('@/components/ui/input/Input.vue', () => ({
  default: {
    props: ['modelValue', 'id', 'placeholder'],
    emits: ['update:modelValue'],
    template: `
      <input
        :id="id"
        :value="modelValue"
        :placeholder="placeholder"
        v-bind="$attrs"
        @input="$emit('update:modelValue', $event.target.value)"
      />
    `
  }
}))

vi.mock('@/components/ui/textarea/Textarea.vue', () => ({
  default: {
    props: ['modelValue', 'id', 'placeholder'],
    emits: ['update:modelValue'],
    template: `
      <textarea
        :id="id"
        :value="modelValue"
        :placeholder="placeholder"
        v-bind="$attrs"
        @input="$emit('update:modelValue', $event.target.value)"
      />
    `
  }
}))

function renderForm(
  props: Partial<ComponentProps<typeof ComfyHubCreateProfileForm>> = {}
) {
  return render(ComfyHubCreateProfileForm, {
    props: {
      onProfileCreated: vi.fn(),
      onClose: vi.fn(),
      ...props
    },
    global: {
      plugins: [i18n]
    }
  })
}

function profileFile(name = 'avatar.png') {
  return new File(['image'], name, { type: 'image/png' })
}

async function flushPromises() {
  await Promise.resolve()
  await nextTick()
}

describe('ComfyHubCreateProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateProfile.mockResolvedValue({
      username: 'valid-user',
      name: 'Valid User'
    })
    mockIsFileTooLarge.mockReturnValue(false)
  })

  it('renders close and cancel actions and can hide the close header button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { unmount } = renderForm({ onClose })

    await user.click(screen.getByRole('button', { name: 'g.close' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'g.cancel' }))
    expect(onClose).toHaveBeenCalledTimes(2)

    unmount()
    renderForm({ onClose, showCloseButton: false })

    expect(
      screen.queryByRole('button', { name: 'g.close' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('validates usernames and derives the profile initial from name or username', async () => {
    const user = userEvent.setup()
    renderForm()

    expect(screen.getByText('C')).toBeInTheDocument()

    await user.type(screen.getByLabelText('comfyHubProfile.nameLabel'), 'Ada')
    expect(screen.getByText('A')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('comfyHubProfile.nameLabel'))
    await user.type(
      screen.getByLabelText('comfyHubProfile.usernameLabel'),
      'bad_name'
    )

    expect(screen.getByText('B')).toBeInTheDocument()
    expect(
      screen.getByText('comfyHubProfile.usernameError')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'comfyHubProfile.createProfile' })
    ).toBeDisabled()
  })

  it('ignores oversized images and previews an accepted profile image', async () => {
    const user = userEvent.setup()
    renderForm()

    const input = screen.getByLabelText('comfyHubProfile.chooseProfilePicture')

    mockIsFileTooLarge.mockReturnValueOnce(true)
    await user.upload(input, profileFile('large.png'))
    expect(
      screen.queryByAltText('comfyHubProfile.chooseProfilePicture')
    ).not.toBeInTheDocument()

    const acceptedFile = profileFile()
    await user.upload(input, acceptedFile)

    expect(mockIsFileTooLarge).toHaveBeenLastCalledWith(acceptedFile, 10)
    expect(
      screen.getByAltText('comfyHubProfile.chooseProfilePicture')
    ).toHaveAttribute('src', 'blob:avatar.png')
  })

  it('creates a trimmed profile and reports it to the parent', async () => {
    const user = userEvent.setup()
    const onProfileCreated = vi.fn()
    renderForm({ onProfileCreated })

    const file = profileFile()
    const input = screen.getByLabelText('comfyHubProfile.chooseProfilePicture')

    await user.upload(input, file)
    await user.type(
      screen.getByLabelText('comfyHubProfile.usernameLabel'),
      'valid-user'
    )
    await user.type(
      screen.getByLabelText('comfyHubProfile.nameLabel'),
      ' Ada Lovelace '
    )
    await user.type(
      screen.getByLabelText('comfyHubProfile.descriptionLabel'),
      '   '
    )
    await user.click(
      screen.getByRole('button', { name: 'comfyHubProfile.createProfile' })
    )

    expect(mockCreateProfile).toHaveBeenCalledWith({
      username: 'valid-user',
      name: 'Ada Lovelace',
      description: undefined,
      profilePicture: file
    })
    expect(onProfileCreated).toHaveBeenCalledWith({
      username: 'valid-user',
      name: 'Valid User'
    })
  })

  it('shows loading text while creating and surfaces creation errors', async () => {
    const user = userEvent.setup()
    let resolveCreate: (profile: { username: string }) => void
    mockCreateProfile.mockReturnValueOnce(
      new Promise<{ username: string }>((resolve) => {
        resolveCreate = resolve
      })
    )
    renderForm()

    await user.type(
      screen.getByLabelText('comfyHubProfile.usernameLabel'),
      'valid-user'
    )
    await user.click(
      screen.getByRole('button', { name: 'comfyHubProfile.createProfile' })
    )
    await nextTick()

    expect(
      screen.getByRole('button', { name: 'comfyHubProfile.creatingProfile' })
    ).toBeDisabled()

    resolveCreate!({ username: 'valid-user' })
    await flushPromises()

    mockCreateProfile.mockRejectedValueOnce(new Error('already taken'))
    await user.click(
      screen.getByRole('button', { name: 'comfyHubProfile.createProfile' })
    )
    await nextTick()

    expect(mockToast.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'already taken'
    })

    mockCreateProfile.mockRejectedValueOnce('unknown')
    await user.click(
      screen.getByRole('button', { name: 'comfyHubProfile.createProfile' })
    )
    await nextTick()

    expect(mockToast.add).toHaveBeenLastCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'g.error'
    })
  })
})
