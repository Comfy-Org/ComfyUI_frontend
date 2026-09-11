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

function embedStyle() {
  render(HubspotFormEmbed, { props: { formId: FORM_ID } })
  return screen.getByTestId('hubspot-form-embed').style
}

function declarations(style: CSSStyleDeclaration): [string, string][] {
  return [...style.cssText.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)].map(
    ([, property, value]) => [property, value.trim()]
  )
}

let createElementSpy: ReturnType<typeof stubScriptLoading>

beforeEach(() => {
  createElementSpy = stubScriptLoading()
})
afterEach(() => loaderScript()?.remove())

describe('HubspotFormEmbed', () => {
  it('addresses the requested form on the embed container', () => {
    render(HubspotFormEmbed, { props: { formId: FORM_ID } })

    const embed = screen.getByTestId('hubspot-form-embed')
    expect(embed.getAttribute('data-form-id')).toBe(FORM_ID)
    expect(embed.getAttribute('data-portal-id')).toBe('244637579')
    expect(embed.getAttribute('data-region')).toBe('na2')
  })

  it('loads the HubSpot script once however many embeds mount', () => {
    render(HubspotFormEmbed, { props: { formId: FORM_ID } })
    render(HubspotFormEmbed, { props: { formId: 'a-second-form' } })

    expect(scriptsCreated(createElementSpy)).toBe(1)
    expect(loaderScript()?.src).toBe(SCRIPT_SRC)
  })

  it('offers an email fallback when the script fails to load', async () => {
    render(HubspotFormEmbed, { props: { formId: FORM_ID } })

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

  // Unset, these fall back to `--hsf-field-input__padding`, and HubSpot sizes
  // its `appearance: none` boxes purely from padding — so they render at 34px.
  it('sizes checkboxes and radios smaller than the text input', () => {
    const style = embedStyle()
    const paddingPx = (property: string) => {
      const value = style.getPropertyValue(property)
      expect(value).toMatch(/^\d+px$/)
      return Number.parseInt(value, 10)
    }

    const inputPadding = paddingPx('--hsf-field-input__padding')

    for (const control of ['checkbox', 'radio']) {
      expect(paddingPx(`--hsf-field-${control}__padding`)).toBeLessThan(
        inputPadding
      )
    }
  })

  it('resolves every colour through a theme token', () => {
    const colours = declarations(embedStyle()).filter(([property]) =>
      property.endsWith('color')
    )

    expect(colours.length).toBeGreaterThan(0)
    for (const [property, value] of colours) {
      expect(`${property}: ${value}`).toMatch(/var\(--color-/)
    }
  })

  it('gives the submit button hover and focus states', () => {
    const declared = new Map(declarations(embedStyle()))

    for (const state of ['hover', 'focus']) {
      expect(declared.get(`--hsf-button--${state}__background-color`)).toMatch(
        /var\(--color-/
      )
    }
  })
})
