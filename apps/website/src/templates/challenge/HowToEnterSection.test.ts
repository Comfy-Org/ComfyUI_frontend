import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import HowToEnterSection from './HowToEnterSection.vue'

const props = {
  signupHref: 'https://example.com/signup',
  submitHref: 'https://example.com/submit'
}

const textsOf = (elements: HTMLElement[]) =>
  elements.map((element) => element.textContent.trim())

async function openStep(name: string) {
  await userEvent.click(screen.getByRole('button', { name }))
  return screen.findByRole('region', { name })
}

describe('HowToEnterSection', () => {
  it('renders the localized heading and open sign-up step', () => {
    render(HowToEnterSection, { props: { ...props, locale: 'zh-CN' } })

    expect(
      screen.getByRole('heading', { level: 2, name: '如何参赛' })
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '点此报名' })).toHaveAttribute(
      'href',
      props.signupHref
    )
  })

  it('numbers the four steps in order', () => {
    render(HowToEnterSection, { props })

    expect(textsOf(screen.getAllByRole('button'))).toEqual([
      '1. Sign up',
      '2. App requirements',
      '3. Prepare your submission',
      '4. Submit'
    ])
  })

  it.for([
    {
      locale: 'en',
      step: '2. App requirements',
      name: 'Developer Platform',
      href: '/platform/'
    },
    {
      locale: 'en',
      step: '2. App requirements',
      name: 'Comfy SDK',
      href: 'https://docs.comfy.org/development/api-development/sdks'
    },
    {
      locale: 'zh-CN',
      step: '2. 应用要求',
      name: '开发者平台',
      href: '/zh-CN/platform/'
    },
    {
      locale: 'zh-CN',
      step: '2. 应用要求',
      name: 'Comfy SDK',
      href: 'https://docs.comfy.org/zh/development/api-development/sdks'
    }
  ] as const)(
    'links the $locale "$name" requirement to $href',
    async ({ locale, step, name, href }) => {
      render(HowToEnterSection, { props: { ...props, locale } })

      const region = await openStep(step)

      expect(within(region).getByRole('link', { name })).toHaveAttribute(
        'href',
        href
      )
    }
  )

  it('lists every app requirement in order', async () => {
    render(HowToEnterSection, { props })

    const region = await openStep('2. App requirements')

    expect(textsOf(within(region).getAllByRole('listitem'))).toEqual([
      'Your work must be built with ComfyUI. Run it however you like: entirely local, Comfy Cloud, the Developer Platform, Comfy Router, the Comfy SDK, or any mix of them',
      'Your repo must include an open-source license and enough setup detail that someone else can run it on their own machine',
      'Any other tools, models, or techniques you want to combine with it are fair game and must be explained in your demo video',
      'All submissions must be lawful, SFW, and must not contain unlicensed IP or likenesses',
      'By submitting, you agree to allow ComfyUI, Runpod, LTX, Black Forest Labs, and MiniMax to feature your work with credit across our channels',
      'One submission per person'
    ])
  })

  it('lists the four deliverables in order', async () => {
    render(HowToEnterSection, { props })

    const region = await openStep('3. Prepare your submission')

    expect(textsOf(within(region).getAllByRole('listitem'))).toEqual([
      expect.stringMatching(/^GitHub repo/),
      expect.stringMatching(/^Demo video/),
      expect.stringMatching(/^A link to try it/),
      expect.stringMatching(/^Social post/)
    ])
  })

  it('stacks sign-up and submit calls to action under the heading', () => {
    render(HowToEnterSection, { props })

    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      props.signupHref
    )
    expect(
      screen.getByRole('link', { name: 'Submit your entry' })
    ).toHaveAttribute('href', props.submitHref)
  })

  it('ends the steps with the submit entry call to action', async () => {
    render(HowToEnterSection, { props })

    const region = await openStep('4. Submit')

    expect(
      within(region).getByRole('link', { name: 'Submit your entry' })
    ).toHaveAttribute('href', props.submitHref)
  })
})
