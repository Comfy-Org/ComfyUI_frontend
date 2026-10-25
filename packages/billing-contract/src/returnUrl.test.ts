import { describe, expect, it } from 'vitest'

import { readWorkspaceLink } from '@comfyorg/account-core/workspaceLink'

import { buildReturnUrl, parseReturnResult } from './returnUrl'

describe('buildReturnUrl', () => {
  it.for(['success', 'cancelled', 'pending'] as const)(
    'round-trips the %s outcome with its reference',
    (result) => {
      const url = buildReturnUrl({
        target: 'comfyui_workspace',
        environment: 'production',
        workspace: undefined,
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
        workspace: undefined,
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
      workspace: undefined,
      result: 'success',
      reference: 'op 42/../'
    })

    expect(parseReturnResult(url?.href ?? '')).toEqual({ result: 'success' })
  })

  it('omits the outcome when billing has none to report', () => {
    const url = buildReturnUrl({
      target: 'comfyui_workspace',
      environment: 'production',
      workspace: undefined,
      reference: 'op_42'
    })

    expect(parseReturnResult(url?.href ?? '')).toEqual({ reference: 'op_42' })
  })

  it('returns nothing for a target the environment cannot resolve', () => {
    expect(
      buildReturnUrl({
        target: 'platform_account',
        environment: 'test',
        workspace: 'ws_team'
      })
    ).toBeUndefined()
  })

  it.for([
    [
      'comfyui_workspace',
      'https://cloud.comfy.org/?workspace=ws_team&billing_result=success'
    ],
    [
      'comfyui_credits',
      'https://cloud.comfy.org/?settings=plan-credits&workspace=ws_team&billing_result=success'
    ],
    [
      'platform_account',
      'https://platform.comfy.org/?workspace=ws_team&billing_result=success'
    ]
  ] as const)(
    'names the billed workspace on the way back to %s',
    ([target, href]) => {
      const url = buildReturnUrl({
        target,
        environment: 'production',
        workspace: 'ws_team',
        result: 'success'
      })

      expect(url?.href).toBe(href)
      expect(readWorkspaceLink(url ?? '')).toEqual({
        status: 'ok',
        workspaceId: 'ws_team'
      })
    }
  )

  it('names no workspace when billing has none to report', () => {
    const url = buildReturnUrl({
      target: 'comfyui_credits',
      environment: 'production',
      workspace: undefined
    })

    expect(url?.href).toBe('https://cloud.comfy.org/?settings=plan-credits')
  })

  it.for(['', 'ws team', 'ws/../other'])(
    'drops a workspace id %j that is not opaque',
    (workspace) => {
      const url = buildReturnUrl({
        target: 'comfyui_workspace',
        environment: 'production',
        workspace
      })

      expect(url?.href).toBe('https://cloud.comfy.org/')
    }
  )
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
