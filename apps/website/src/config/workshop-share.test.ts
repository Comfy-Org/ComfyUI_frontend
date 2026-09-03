import { describe, expect, it } from 'vitest'

import {
  SHARE_DEFAULTS,
  decodeShareSearch,
  encodeShareSearch
} from './workshop-share'

describe('share links for the prototype controls', () => {
  it('encodes only what differs from the defaults and keeps other params', () => {
    expect(encodeShareSearch(SHARE_DEFAULTS)).toBe('')
    expect(
      encodeShareSearch(
        {
          ...SHARE_DEFAULTS,
          version: 'v2',
          session: 'existing',
          balance: 'low',
          member: true,
          outcome: 'timeout',
          modelState: 'degraded',
          outputCount: 4
        },
        '?useCase=edit-images&outcome=stale'
      )
    ).toBe(
      '?useCase=edit-images&version=v2&session=existing&balance=low&member=1&outcome=timeout&state=degraded&outputs=4'
    )
  })

  it('carries the version so a link opens the browseable rows', () => {
    expect(encodeShareSearch({ ...SHARE_DEFAULTS, version: 'v1.1' })).toBe(
      '?version=v1.1'
    )
    expect(decodeShareSearch('?version=v1.1').version).toBe('v1.1')
    expect(decodeShareSearch('?version=nope').version).toBeUndefined()
  })

  it('leaves the subscription out of a signed-out link', () => {
    expect(encodeShareSearch({ ...SHARE_DEFAULTS, subscribed: false })).toBe('')
    expect(
      encodeShareSearch({
        ...SHARE_DEFAULTS,
        session: 'new',
        subscribed: false
      })
    ).toBe('?session=new&subscribed=0')
  })

  it('decodes a link and ignores values it does not know', () => {
    expect(
      decodeShareSearch(
        '?version=v2&statuses=1&session=existing&balance=zero&member=1&outputs=9&state=nope&outcome=42'
      )
    ).toEqual({
      version: 'v2',
      showStatuses: true,
      session: 'existing',
      balance: 'zero',
      member: true,
      outputCount: 9
    })
    expect(decodeShareSearch('?useCase=text')).toEqual({})
    expect(
      decodeShareSearch(encodeShareSearch(SHARE_DEFAULTS, '?version=v2'))
    ).toEqual({})
  })
})
