// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableMainFrameNavigation":true,"disableChildPageNavigation":true}}}
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'

import CatalogueTabs from './CatalogueTabs.vue'

const linkProps = { links: true, modelValue: 'models' as const }

it.for([false, true])(
  'uses Chinese tab paths only when locale links are enabled (%s)',
  (localeLinks) => {
    const props = { ...linkProps, locale: 'zh-CN' as const, localeLinks }
    render(CatalogueTabs, { props })
    const prefix = localeLinks ? '/zh-CN' : ''
    for (const tab of ['models', 'workflows', 'apps']) {
      expect(screen.getByTestId(`catalogue-tab-${tab}`)).toHaveAttribute(
        'href',
        `${prefix}/hub/${tab}/`
      )
    }
  }
)

it('emits link intent without canceling normal navigation or changing the model', async () => {
  const view = render(CatalogueTabs, {
    props: linkProps
  })
  const anchor = screen.getByTestId('catalogue-tab-workflows')
  expect(anchor).toHaveAttribute('href', '/hub/workflows/')
  const prevented = vi.fn()
  anchor.addEventListener('click', (event) => prevented(event.defaultPrevented))
  await userEvent.setup().click(anchor)
  expect(prevented).toHaveBeenCalledExactlyOnceWith(false)
  expect(view.emitted('navigate')).toEqual([['workflows']])
  expect(view.emitted('update:modelValue')).toBeUndefined()
})

it.for([
  { button: '[MouseMiddle]', modifier: undefined },
  { button: '[MouseLeft]', modifier: 'Meta' },
  { button: '[MouseLeft]', modifier: 'Control' },
  { button: '[MouseLeft]', modifier: 'Shift' },
  { button: '[MouseLeft]', modifier: 'Alt' }
])(
  'does not emit link intent for modified or non-primary clicks (%j)',
  async ({ button, modifier }) => {
    const view = render(CatalogueTabs, {
      props: linkProps
    })
    const user = userEvent.setup()
    if (modifier) await user.keyboard(`{${modifier}>}`)
    await user.pointer({
      keys: button,
      target: screen.getByTestId('catalogue-tab-workflows')
    })
    if (modifier) await user.keyboard(`{/${modifier}}`)
    expect(view.emitted('navigate')).toBeUndefined()
  }
)

it('does not emit intent for another browsing context or an already-canceled click', async () => {
  const view = render(CatalogueTabs, {
    props: linkProps
  })
  const anchor = screen.getByTestId('catalogue-tab-workflows')
  const user = userEvent.setup()
  anchor.setAttribute('target', '_blank')
  await user.click(anchor)
  anchor.removeAttribute('target')
  anchor.addEventListener('click', (event) => event.preventDefault(), {
    capture: true
  })
  await user.click(anchor)
  expect(view.emitted('navigate')).toBeUndefined()
})

it('keeps CCC tabs native before hydration, then enables immediate enhanced navigation', async () => {
  const props = { ...linkProps, localeLinks: true }
  const html = await renderToString(createSSRApp(() => h(CatalogueTabs, props)))
  const server = new DOMParser().parseFromString(html, 'text/html')
  const workflows = within(server.body).getByRole('link', { name: 'Workflows' })
  expect(workflows).toHaveAttribute('data-astro-reload')
  const user = userEvent.setup()
  const { emitted } = render(CatalogueTabs, { props })
  const link = screen.getByTestId('catalogue-tab-workflows')
  await waitFor(() => expect(link).not.toHaveAttribute('data-astro-reload'))
  await user.click(link)
  expect(emitted('navigate')).toEqual([['workflows']])
})

it.for(['attribute', 'event'])(
  'waits for the owning CCC island completion via %s after its Vue child mounts',
  async (completion) => {
    const island = document.createElement('astro-island')
    island.setAttribute('ssr', '')
    island.setAttribute('data-astro-transition-persist', 'ccc-hub-catalogue-en')
    const container = document.createElement('div')
    island.append(container)
    document.body.append(island)
    const view = render(CatalogueTabs, {
      container,
      props: { ...linkProps, localeLinks: true }
    })
    const link = view.getByTestId('catalogue-tab-workflows')
    await nextTick()
    expect(link).toHaveAttribute('data-astro-reload')
    await userEvent.setup().click(link)
    expect(view.emitted('navigate')).toBeUndefined()
    const nestedIsland = document.createElement('astro-island')
    island.append(nestedIsland)
    nestedIsland.dispatchEvent(
      new CustomEvent('astro:hydrate', { bubbles: true })
    )
    await nextTick()
    expect(link).toHaveAttribute('data-astro-reload')
    island.dispatchEvent(new CustomEvent('astro:hydrate'))
    await nextTick()
    expect(link).toHaveAttribute('data-astro-reload')
    island.removeAttribute('ssr')
    if (completion === 'event')
      island.dispatchEvent(new CustomEvent('astro:hydrate'))
    await waitFor(() => expect(link).not.toHaveAttribute('data-astro-reload'))
    await userEvent.setup().click(link)
    expect(view.emitted('navigate')).toEqual([['workflows']])
    view.unmount()
    island.remove()
  }
)
