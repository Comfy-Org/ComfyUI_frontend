// @vitest-environment-options {"settings":{"navigation":{"disableMainFrameNavigation":true,"disableChildPageNavigation":true}}}
import userEvent from '@testing-library/user-event'
import { within } from '@testing-library/vue'
import { afterEach, expect, it, vi } from 'vitest'

import { installNativeCatalogueTabNavigation } from './native-tab-feedback'

let stop: (() => void) | undefined
let fixture: HTMLElement | undefined
afterEach(() => {
  stop?.()
  fixture?.remove()
})
function setup(persist = 'ccc-hub-catalogue-en', reload = true) {
  fixture = document.createElement('div')
  const island = document.createElement('astro-island')
  island.setAttribute('data-astro-transition-persist', persist)
  island.setAttribute('ssr', '')
  fixture.append(island)
  island.innerHTML = `<nav aria-label="Catalog" data-testid="catalogue-tabs"><span data-testid="catalogue-marker" style="transform:translateX(0%)"></span><a href="/hub/models/" aria-current="page" ${reload ? 'data-astro-reload' : ''}>Models</a><a href="/hub/workflows/" ${reload ? 'data-astro-reload' : ''}>Workflows</a></nav>`
  document.body.append(fixture)
  stop = installNativeCatalogueTabNavigation()
  const view = within(fixture)
  return {
    view,
    island,
    nav: view.getByRole('navigation'),
    marker: view.getByTestId('catalogue-marker'),
    link: view.getByRole('link', { name: 'Workflows' })
  }
}
it('cancels the current load and abandons its island before starting the selected page', async () => {
  const user = userEvent.setup()
  const { view, link, island } = setup()
  const steps: string[] = []
  vi.stubGlobal(
    'stop',
    vi.fn(() => {
      steps.push('stop')
    })
  )
  vi.spyOn(window.location, 'assign').mockImplementation((url) => {
    steps.push(String(url))
  })
  let canceled: boolean | undefined
  link.addEventListener('click', (event) =>
    queueMicrotask(() => {
      canceled = event.defaultPrevented
    })
  )
  await user.click(link)
  const marker = view.getByTestId('catalogue-marker')
  const nav = view.getByRole('navigation')
  expect(marker).toHaveStyle({ transform: 'translateX(100%)' })
  expect(nav).toHaveAttribute('aria-busy', 'true')
  expect(link).not.toHaveAttribute('aria-current')
  expect(canceled).toBe(true)
  expect(steps).toEqual([
    'stop',
    new URL('/hub/workflows/', location.href).href
  ])
  expect(island).not.toBeInTheDocument()
  window.dispatchEvent(new Event('pageshow'))
  expect(marker).toHaveStyle({ transform: 'translateX(0%)' })
  expect(nav).not.toHaveAttribute('aria-busy')
})
it.for([
  'legacy',
  'hydrated',
  'hydrated-island',
  'canceled',
  'modifier',
  'other-context'
])('preserves %s navigation behavior', async (kind) => {
  const user = userEvent.setup()
  const { nav, marker, link, island } = setup(
    kind === 'legacy' ? 'hub-catalogue' : undefined,
    kind !== 'hydrated'
  )
  const stopLoading = vi.fn()
  vi.stubGlobal('stop', stopLoading)
  const navigate = vi
    .spyOn(window.location, 'assign')
    .mockImplementation(() => {})
  if (kind === 'hydrated-island') island.removeAttribute('ssr')
  if (kind === 'canceled')
    link.addEventListener('click', (event) => event.preventDefault())
  if (kind === 'other-context') link.setAttribute('target', '_blank')
  if (kind === 'modifier') await user.keyboard('{Control>}')
  await user.click(link)
  expect(marker).toHaveStyle({ transform: 'translateX(0%)' })
  expect(nav).not.toHaveAttribute('aria-busy')
  expect(stopLoading).not.toHaveBeenCalled()
  expect(navigate).not.toHaveBeenCalled()
})

it('restarts the former page from a fresh document when returning through the browser cache', async () => {
  const user = userEvent.setup()
  const { link } = setup()
  vi.stubGlobal('stop', vi.fn())
  vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  const reload = vi
    .spyOn(window.location, 'reload')
    .mockImplementation(() => {})
  await user.click(link)
  const restored = new Event('pageshow')
  Object.defineProperty(restored, 'persisted', { value: true })
  window.dispatchEvent(restored)
  expect(reload).toHaveBeenCalledOnce()
})

it('lets another early click supersede the pending destination', async () => {
  const user = userEvent.setup()
  const { link, island, view } = setup()
  const stopLoading = vi.fn()
  vi.stubGlobal('stop', stopLoading)
  const navigate = vi
    .spyOn(window.location, 'assign')
    .mockImplementation(() => {})
  await user.click(link)
  await user.click(view.getByRole('link', { name: 'Models' }))
  expect(island).not.toBeInTheDocument()
  expect(stopLoading).toHaveBeenCalledTimes(2)
  expect(navigate).toHaveBeenCalledTimes(2)
  expect(navigate).toHaveBeenLastCalledWith(
    new URL('/hub/models/', location.href).href
  )
})

it('isolates displayed content from late updates by the abandoned Vue instance', async () => {
  const user = userEvent.setup()
  const { view, link, nav, marker } = setup()
  vi.stubGlobal('stop', vi.fn())
  vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  await user.click(link)
  marker.style.transform = 'translateX(0%)'
  nav.replaceChildren(document.createTextNode('Late old page update'))
  expect(view.getByRole('link', { name: 'Models' })).toBeVisible()
  expect(view.getByTestId('catalogue-marker')).toHaveStyle({
    transform: 'translateX(100%)'
  })
  expect(view.queryByText('Late old page update')).not.toBeInTheDocument()
})
