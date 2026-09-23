import { describe, expect, it } from 'vitest'

import { buildReturnUrl, parseReturnResult } from './returnUrl'

describe('buildReturnUrl', () => {
  it.for(['success', 'cancelled', 'pending'] as const)(
    'round-trips the %s outcome with its reference',
    (result) => {
      const url = buildReturnUrl({
        target: 'comfyui_workspace',
        environment: 'production',
        result,
        reference: 'op_42'
      })

      expect(parseReturnResult(url?.href ?? '')).toEqual({
        result,
        reference: 'op_42'
      })
    }
  )

  it('keeps the query the destination already carries', () => {
    expect(
      buildReturnUrl({
        target: 'comfyui_credits',
        environment: 'staging',
        result: 'success'
      })?.href
    ).toBe(
      'https://stagingcloud.comfy.org/?settings=plan-credits&billing_result=success'
    )
  })

  it('drops a reference that is not opaque', () => {
    const url = buildReturnUrl({
      target: 'comfyui_workspace',
      environment: 'production',
      result: 'success',
      reference: 'op 42/../'
    })

    expect(parseReturnResult(url?.href ?? '')).toEqual({ result: 'success' })
  })

  it('omits the outcome when billing has none to report', () => {
    const url = buildReturnUrl({
      target: 'comfyui_workspace',
      environment: 'production',
      reference: 'op_42'
    })

    expect(parseReturnResult(url?.href ?? '')).toEqual({ reference: 'op_42' })
  })

  it('returns nothing for a target the environment cannot resolve', () => {
    expect(
      buildReturnUrl({ target: 'platform_account', environment: 'test' })
    ).toBeUndefined()
  })
})

describe('parseReturnResult', () => {
  it.for([
    'https://cloud.comfy.org/',
    'https://cloud.comfy.org/?billing_result=partially_refunded',
    'https://cloud.comfy.org/?billing_ref=op%2042',
    'not a url',
    'http://['
  ])('reads nothing usable out of %s', (url) => {
    expect(parseReturnResult(url)).toEqual({})
  })
})
