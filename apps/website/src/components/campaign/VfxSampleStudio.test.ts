import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, expect, it } from 'vitest'

import VfxSampleStudio from './VfxSampleStudio.vue'

import { stubIntersectionObserver } from '@/test/fakeIntersectionObserver'

beforeEach(() => {
  stubIntersectionObserver()
})

it('restores the selected sample and builds the request from edited settings', async () => {
  const user = userEvent.setup()
  const showcase = document.createElement('vfx-workflow-showcase')
  showcase.dataset.selectedVariant = 'relight_night'
  document.body.append(showcase)
  render(VfxSampleStudio, {
    container: showcase,
    props: {
      demo: 'relight',
      source: 'relight_before',
      mediaKind: 'video',
      variants: [
        { id: 'relight_golden', label: 'Golden hour' },
        { id: 'relight_night', label: 'Night' }
      ],
      workflowHref: 'https://cloud.comfy.org/?workflow=8b18c850d38a'
    }
  })

  await user.click(screen.getByRole('tab', { name: 'SETTINGS' }))
  expect(screen.getByRole('button', { name: 'Night' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await user.click(screen.getByRole('button', { name: 'Golden hour' }))
  expect(showcase).toHaveAttribute('data-selected-variant', 'relight_golden')
  expect(screen.getByRole('button', { name: 'Night' })).toHaveAttribute(
    'aria-pressed',
    'false'
  )
  const description = screen.getByRole('textbox', { name: 'Describe the shot' })
  await user.clear(description)
  await user.type(description, 'A car arrives at the diner.')
  await user.type(
    screen.getByRole('textbox', { name: 'Describe the light and weather' }),
    'Warm sunset'
  )
  await user.click(screen.getByRole('tab', { name: 'WORKFLOW' }))

  expect(screen.getByText(/Selected sample: Warm sunset/)).toHaveTextContent(
    'Selected sample: Warm sunset Shot description: A car arrives at the diner.'
  )
  expect(
    screen.getByRole('link', { name: 'EXPOSE WORKFLOW ↗' })
  ).toHaveAttribute('href', 'https://cloud.comfy.org/?workflow=8b18c850d38a')
})
