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
          entry: 'hub',
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
      '?useCase=edit-images&entry=hub&session=existing&balance=low&member=1&outcome=timeout&state=degraded&outputs=4'
    )
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
        '?scope=v2&entry=hub&statuses=1&session=existing&balance=zero&member=1&outputs=9&state=nope&outcome=42'
      )
    ).toEqual({
      scope: 'v2',
      entry: 'hub',
      showStatuses: true,
      session: 'existing',
      balance: 'zero',
      member: true,
      outputCount: 9
    })
    expect(decodeShareSearch('?useCase=text')).toEqual({})
    expect(
      decodeShareSearch(encodeShareSearch(SHARE_DEFAULTS, '?entry=hub'))
    ).toEqual({})
  })
})
