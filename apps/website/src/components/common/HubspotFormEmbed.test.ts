// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import HubspotFormEmbed from './HubspotFormEmbed.vue'

const FORM_ID = '40ef858c-374a-4958-8180-bfa54f0a67fb'
const SCRIPT_ID = 'hubspot-form-embed'
const SCRIPT_SRC =
  'https://js-na2.hsforms.net/forms/embed/developer/244637579.js'

// happy-dom fetches any <script src> the moment it is connected and then fires
// `error` — the very event under test. Shadowing `src` on the instance leaves
// the attribute unset, so nothing loads and the error path fires only when a
// test asks for it.
function stubScriptLoading() {
  const createElement = document.createElement.bind(document)
  return vi
    .spyOn(document, 'createElement')
    .mockImplementation((tagName: string) => {
      const element = createElement(tagName)
      if (tagName === 'script') {
        let src = ''
        Object.defineProperty(element, 'src', {
          get: () => src,
          set: (value: string) => {
            src = value
          }
        })
      }
      return element
    })
}

function scriptsCreated(spy: ReturnType<typeof stubScriptLoading>) {
  return spy.mock.calls.filter(([tagName]) => tagName === 'script').length
}

function loaderScript() {
  return document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
}

let createElementSpy: ReturnType<typeof stubScriptLoading>

beforeEach(() => {
  createElementSpy = stubScriptLoading()
})
afterEach(() => loaderScript()?.remove())

describe('HubspotFormEmbed', () => {
  it('addresses the requested form on the embed container', () => {
    render(HubspotFormEmbed, { props: { formId: FORM_ID, locale: 'en' } })

    const embed = screen.getByTestId('hubspot-form-embed')
    expect(embed.getAttribute('data-form-id')).toBe(FORM_ID)
    expect(embed.getAttribute('data-portal-id')).toBe('244637579')
    expect(embed.getAttribute('data-region')).toBe('na2')
  })

  it('loads the HubSpot script once however many embeds mount', () => {
    render(HubspotFormEmbed, { props: { formId: FORM_ID, locale: 'en' } })
    render(HubspotFormEmbed, {
      props: { formId: 'a-second-form', locale: 'en' }
    })

    expect(scriptsCreated(createElementSpy)).toBe(1)
    expect(loaderScript()?.src).toBe(SCRIPT_SRC)
  })

  it('offers an email fallback when the script fails to load', async () => {
    render(HubspotFormEmbed, { props: { formId: FORM_ID, locale: 'en' } })

    loaderScript()?.dispatchEvent(new Event('error'))
    await nextTick()

    expect(screen.queryByTestId('hubspot-form-embed')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain(
      'Unable to load the form'
    )
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      'mailto:hello@comfy.org'
    )
  })
})
