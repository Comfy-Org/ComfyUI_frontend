import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { studioT as rc } from '../../../../lib/workshop/cinematic-studio/copy'
import ReshootExamples from './ReshootExamples.vue'

describe('ReshootExamples', () => {
  it('names the examples in the locale it is given now', async () => {
    const { rerender } = render(ReshootExamples, { props: { locale: 'en' } })
    expect(
      screen.getByText(rc('reshoot.pick.exampleTitle', {}, { locale: 'en' }))
    ).toBeInTheDocument()

    await rerender({ locale: 'zh-CN' })

    expect(
      screen.getByText(rc('reshoot.pick.exampleTitle', {}, { locale: 'zh-CN' }))
    ).toBeInTheDocument()
  })
})
