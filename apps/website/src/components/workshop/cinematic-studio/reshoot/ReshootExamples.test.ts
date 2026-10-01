import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { translationsFor } from '../../../../i18n/translations'
import ReshootExamples from './ReshootExamples.vue'

const { t: english } = translationsFor('en')
const { t: chinese } = translationsFor('zh-CN')

describe('ReshootExamples', () => {
  it.for([
    { locale: 'en', expected: english('reshoot.pick.exampleTitle') },
    { locale: 'zh-CN', expected: chinese('reshoot.pick.exampleTitle') }
  ] as const)('names the $locale example', ({ locale, expected }) => {
    render(ReshootExamples, { props: { locale } })

    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})
