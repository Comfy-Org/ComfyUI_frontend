import { describe, expect, it } from 'vitest'
import { reviewFieldErrors } from './review-errors'

describe('private review validation details', () => {
  it('retains only field paths and messages', () => {
    expect(
      reviewFieldErrors({
        field_errors: [
          { path: '$.thumbnail', message: 'Missing pin', debug: 'omit' }
        ],
        secret: 'omit'
      })
    ).toEqual([{ path: '$.thumbnail', message: 'Missing pin' }])
  })

  it.for([
    undefined,
    { field_errors: 'invalid' },
    { field_errors: [{ path: 1, message: 'invalid' }] },
    { field_errors: [{ path: 'x'.repeat(2001), message: 'invalid' }] },
    { field_errors: [{ path: '$', message: 'x'.repeat(1001) }] },
    {
      field_errors: Array.from({ length: 101 }, () => ({
        path: '$',
        message: 'bad'
      }))
    }
  ])('rejects malformed or oversized details: %j', (raw) => {
    expect(reviewFieldErrors(raw)).toEqual([])
  })
})
