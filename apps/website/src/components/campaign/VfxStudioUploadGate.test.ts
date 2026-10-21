import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { afterEach, expect, it, vi } from 'vitest'
import VfxSampleStudio from './VfxSampleStudio.vue'
import { stubIntersectionObserver } from '@/test/fakeIntersectionObserver'

const SIGNUP = 'https://cloud.comfy.org/cloud/signup'
const DESTINATION = `${SIGNUP}?utm_source=linkedin&utm_medium=paid_social&utm_campaign=vfx&utm_content=v3`
function renderStudio(locale: 'en' | 'zh-CN' = 'en') {
  stubIntersectionObserver()
  return render(VfxSampleStudio, {
    props: {
      demo: 'relight',
      source: 'diner',
      mediaKind: 'video',
      locale,
      variants: [
        { id: 'relight_golden', label: 'Golden hour' },
        { id: 'relight_blue', label: 'Red sky' }
      ]
    }
  })
}
function campaign() {
  window.history.replaceState(
    null,
    '',
    '/solutions/vfx/v3/?utm_source=linkedin&utm_medium=paid_social&utm_campaign=vfx&utm_content=v3&email=private@example.com&filename=private.mov'
  )
}
function transferEvent(
  type: 'drop' | 'dragover',
  types: string[],
  filesRead = vi.fn()
) {
  const transfer = { types, dropEffect: 'none' }
  Object.defineProperty(transfer, 'files', { get: filesRead })
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: transfer })
  return { event, transfer }
}
afterEach(() => window.history.replaceState(null, '', '/'))

it.for([
  { locale: 'en' as const, cta: 'SIGN UP TO TRY FREE' },
  { locale: 'zh-CN' as const, cta: '注册免费试用' }
])(
  'offers the existing signup flow in $locale with only campaign attribution',
  async ({ locale, cta }) => {
    campaign()
    renderStudio(locale)
    await waitFor(() =>
      expect(screen.getByRole('link', { name: cta })).toHaveAttribute(
        'href',
        DESTINATION
      )
    )
  }
)
it('sends a file-drop intent to signup without reading file names or bytes', async () => {
  campaign()
  const assign = vi
    .spyOn(window.location, 'assign')
    .mockImplementation(() => {})
  const networkFetch = vi.mocked(window.fetch)
  const filesRead = vi.fn(() => {
    throw new Error('File data must not be accessed')
  })
  renderStudio()
  const { event } = transferEvent('drop', ['Files'], filesRead)
  await fireEvent(
    screen.getByRole('region', { name: 'Change time, weather & light' }),
    event
  )
  expect(event.defaultPrevented).toBe(true)
  expect(assign).toHaveBeenCalledExactlyOnceWith(DESTINATION)
  expect(filesRead).not.toHaveBeenCalled()
  expect(networkFetch).not.toHaveBeenCalled()
})
it('allows dropping files only as a signup navigation, without opening an upload', async () => {
  const assign = vi
    .spyOn(window.location, 'assign')
    .mockImplementation(() => {})
  renderStudio()
  const { event, transfer } = transferEvent('dragover', ['Files'])
  await fireEvent(
    screen.getByRole('region', { name: 'Change time, weather & light' }),
    event
  )
  expect(event.defaultPrevented).toBe(true)
  expect(transfer.dropEffect).toBe('link')
  expect(assign).not.toHaveBeenCalled()
})
it('preserves ordinary text drag/drop in Studio settings', async () => {
  const assign = vi
    .spyOn(window.location, 'assign')
    .mockImplementation(() => {})
  renderStudio()
  const { event } = transferEvent('drop', ['text/plain'])
  await fireEvent(
    screen.getByRole('region', { name: 'Change time, weather & light' }),
    event
  )
  expect(event.defaultPrevented).toBe(false)
  expect(assign).not.toHaveBeenCalled()
})
