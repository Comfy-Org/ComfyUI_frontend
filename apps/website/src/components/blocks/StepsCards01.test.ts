// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import StepsCards01 from './StepsCards01.vue'

type StepsCardsProps = ComponentProps<typeof StepsCards01>

const requiredProps = {
  heading: 'From one working setup to an approved fleet',
  steps: [
    {
      id: 'define',
      title: 'Define the build',
      description:
        'Start from a known-good environment or import a snapshot of a setup you already run.'
    },
    {
      id: 'update',
      title: 'Update deliberately',
      description:
        'Cut a new version when you decide. Move the team together without changing work already in flight.'
    }
  ]
} satisfies StepsCardsProps

function renderStepsCards(props: Partial<StepsCardsProps> = {}) {
  return render(StepsCards01, {
    props: { ...requiredProps, ...props }
  })
}

describe('StepsCards01', () => {
  it('renders the heading and each step title with its description', () => {
    renderStepsCards()

    expect(
      screen.getByText('From one working setup to an approved fleet')
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Define the build' })
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Start from a known-good environment or import a snapshot of a setup you already run.'
      )
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Update deliberately' })
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Cut a new version when you decide. Move the team together without changing work already in flight.'
      )
    ).toBeTruthy()
  })
})
