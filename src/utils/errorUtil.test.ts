import { describe, expect, it } from 'vitest'

import { getErrorMessage, toError } from './errorUtil'

describe('toError', () => {
  it('returns the same Error instance when given an Error', () => {
    const err = new Error('boom')
    expect(toError(err)).toBe(err)
  })

  it('preserves Error subclasses', () => {
    class CustomError extends Error {}
    const err = new CustomError('subclass')
    expect(toError(err)).toBe(err)
    expect(toError(err)).toBeInstanceOf(CustomError)
  })

  it('wraps a string as an Error message', () => {
    const result = toError('plain string')
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('plain string')
  })

  it('wraps a number by stringifying it', () => {
    const result = toError(42)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('42')
  })

  it('wraps an object via JSON.stringify', () => {
    const result = toError({ code: 'EBOOM', detail: 'nope' })
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('{"code":"EBOOM","detail":"nope"}')
  })

  it('falls back to String() when JSON.stringify throws (circular)', () => {
    const obj: Record<string, unknown> = {}
    obj.self = obj
    const result = toError(obj)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('[object Object]')
  })

  it('handles null and undefined', () => {
    expect(toError(null).message).toBe('null')
    expect(toError(undefined).message).toBe('undefined')
  })
})

describe('getErrorMessage', () => {
  it('returns the message of an Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns the value when given a string', () => {
    expect(getErrorMessage('text')).toBe('text')
  })

  it('returns the message field of a plain object', () => {
    expect(getErrorMessage({ message: 'from object' })).toBe('from object')
  })

  it('returns undefined for objects without a string message', () => {
    expect(getErrorMessage({ code: 1 })).toBeUndefined()
    expect(getErrorMessage({ message: 42 })).toBeUndefined()
  })

  it('returns undefined for null, undefined, numbers, booleans', () => {
    expect(getErrorMessage(null)).toBeUndefined()
    expect(getErrorMessage(undefined)).toBeUndefined()
    expect(getErrorMessage(42)).toBeUndefined()
    expect(getErrorMessage(true)).toBeUndefined()
  })
})
