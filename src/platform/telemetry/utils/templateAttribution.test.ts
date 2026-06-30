import { describe, expect, it } from 'vitest'

import type { TemplateOpenTrigger } from '../types'
import { templateAttribution } from './templateAttribution'

describe('templateAttribution', () => {
  it('tags id and trigger when the open came from a template', () => {
    expect(
      templateAttribution('template', 'flux_simple', 'starter_template')
    ).toEqual({
      template_id: 'flux_simple',
      open_trigger: 'starter_template'
    })
  })

  it('adds nothing for a non-template open even if tags are passed', () => {
    expect(
      templateAttribution('shared_url', 'flux_simple', 'shared_url')
    ).toEqual({})
  })

  it('adds nothing for a template open missing the id', () => {
    expect(
      templateAttribution('template', undefined, 'library_template')
    ).toEqual({})
  })

  it('adds nothing for a template open missing the trigger', () => {
    expect(templateAttribution('template', 'flux_simple', undefined)).toEqual(
      {}
    )
  })

  it('rejects a trigger value outside the known set', () => {
    const forged = 'malicious_trigger' as unknown as TemplateOpenTrigger
    expect(templateAttribution('template', 'flux_simple', forged)).toEqual({})
  })
})
