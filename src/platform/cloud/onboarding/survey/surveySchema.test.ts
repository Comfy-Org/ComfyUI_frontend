import { describe, expect, it } from 'vitest'

import type { OnboardingSurvey } from '@/platform/remoteConfig/types'

import {
  buildInitialValues,
  buildSubmissionPayload,
  buildZodSchema,
  prepareSurvey,
  visibleFields
} from './surveySchema'

const baseSurvey: OnboardingSurvey = {
  version: 1,
  fields: [
    {
      id: 'usage',
      type: 'single',
      required: true,
      options: [
        { value: 'work', label: 'Work' },
        { value: 'personal', label: 'Personal' }
      ]
    },
    {
      id: 'role',
      type: 'single',
      required: true,
      showWhen: { field: 'usage', equals: 'work' },
      options: [{ value: 'engineer', label: 'Engineer' }]
    },
    {
      id: 'industry',
      type: 'single',
      required: true,
      allowOther: true,
      otherFieldId: 'industryOther',
      showWhen: { field: 'usage', equals: 'work' },
      options: [
        { value: 'tech', label: 'Tech' },
        { value: 'other', label: 'Other' }
      ]
    },
    {
      id: 'making',
      type: 'multi',
      required: true,
      options: [
        { value: 'video', label: 'Video' },
        { value: 'images', label: 'Images' }
      ]
    }
  ]
}

describe('visibleFields', () => {
  it('hides fields when showWhen does not match', () => {
    const visible = visibleFields(baseSurvey, { usage: 'personal' })
    expect(visible.map((f) => f.id)).toEqual(['usage', 'making'])
  })

  it('shows gated fields when showWhen matches', () => {
    const visible = visibleFields(baseSurvey, { usage: 'work' })
    expect(visible.map((f) => f.id)).toEqual([
      'usage',
      'role',
      'industry',
      'making'
    ])
  })

  it('treats array equals as membership', () => {
    const survey: OnboardingSurvey = {
      version: 1,
      fields: [
        {
          id: 'role',
          type: 'single',
          showWhen: { field: 'usage', equals: ['work', 'education'] }
        }
      ]
    }
    expect(visibleFields(survey, { usage: 'education' })).toHaveLength(1)
    expect(visibleFields(survey, { usage: 'personal' })).toHaveLength(0)
  })

  it('intersects multi-select source values with expected set', () => {
    const survey: OnboardingSurvey = {
      version: 1,
      fields: [
        {
          id: 'follow_up',
          type: 'single',
          showWhen: { field: 'making', equals: ['video', '3d'] }
        }
      ]
    }
    expect(visibleFields(survey, { making: [] })).toHaveLength(0)
    expect(visibleFields(survey, { making: ['images'] })).toHaveLength(0)
    expect(visibleFields(survey, { making: ['images', 'video'] })).toHaveLength(
      1
    )
  })
})

describe('buildInitialValues', () => {
  it('initializes single fields to empty string and multi to empty array', () => {
    expect(buildInitialValues(baseSurvey)).toMatchObject({
      usage: '',
      role: '',
      industry: '',
      industryOther: '',
      making: []
    })
  })
})

describe('buildZodSchema', () => {
  it('omits hidden fields from validation', () => {
    const schema = buildZodSchema(baseSurvey, { usage: 'personal' })
    const result = schema.safeParse({ usage: 'personal', making: ['video'] })
    expect(result.success).toBe(true)
  })

  it('requires gated fields once visible', () => {
    const schema = buildZodSchema(baseSurvey, { usage: 'work' })
    const result = schema.safeParse({ usage: 'work', making: ['video'] })
    expect(result.success).toBe(false)
  })

  it('requires "other" detail when option is selected', () => {
    const schema = buildZodSchema(baseSurvey, {
      usage: 'work',
      role: 'engineer',
      industry: 'other',
      making: ['video']
    })
    expect(
      schema.safeParse({
        usage: 'work',
        role: 'engineer',
        industry: 'other',
        industryOther: '',
        making: ['video']
      }).success
    ).toBe(false)
    expect(
      schema.safeParse({
        usage: 'work',
        role: 'engineer',
        industry: 'other',
        industryOther: 'Aerospace',
        making: ['video']
      }).success
    ).toBe(true)
  })
})

describe('buildSubmissionPayload', () => {
  it('clears hidden fields and prefers free-text "other" detail', () => {
    const payload = buildSubmissionPayload(baseSurvey, {
      usage: 'work',
      role: 'engineer',
      industry: 'other',
      industryOther: '  Aerospace ',
      making: ['video']
    })
    expect(payload).toEqual({
      usage: 'work',
      role: 'engineer',
      industry: 'Aerospace',
      making: ['video']
    })
  })

  it('falls back to "other" when free-text is empty', () => {
    const payload = buildSubmissionPayload(baseSurvey, {
      usage: 'work',
      role: 'engineer',
      industry: 'other',
      industryOther: '',
      making: ['video']
    })
    expect(payload.industry).toBe('other')
  })

  it('zeroes out fields hidden by showWhen', () => {
    const payload = buildSubmissionPayload(baseSurvey, {
      usage: 'personal',
      role: 'engineer',
      making: ['video']
    })
    expect(payload).toMatchObject({
      usage: 'personal',
      role: '',
      industry: '',
      making: ['video']
    })
  })
})

describe('prepareSurvey', () => {
  it('preserves option contents but may reorder when randomize=true', () => {
    const survey: OnboardingSurvey = {
      version: 1,
      fields: [
        {
          id: 'making',
          type: 'multi',
          randomize: true,
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
            { value: 'other', label: 'Other' }
          ]
        }
      ]
    }
    const prepared = prepareSurvey(survey)
    const values = prepared.fields[0]!.options!.map((o) => o.value)
    expect(values).toContain('a')
    expect(values).toContain('b')
    expect(values[values.length - 1]).toBe('other')
  })

  it('pins both "other" and "not_sure" at the end while randomizing the rest', () => {
    const survey: OnboardingSurvey = {
      version: 1,
      fields: [
        {
          id: 'intent',
          type: 'multi',
          randomize: true,
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
            { value: 'other', label: 'Other' },
            { value: 'not_sure', label: 'Not sure' }
          ]
        }
      ]
    }
    const prepared = prepareSurvey(survey)
    const values = prepared.fields[0]!.options!.map((o) => o.value)
    expect(values.slice(-2).sort()).toEqual(['not_sure', 'other'])
    expect(values.slice(0, -2).sort()).toEqual(['a', 'b'])
  })
})
