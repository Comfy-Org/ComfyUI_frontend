import { describe, expect, it } from 'vitest'
import { accountPackageId } from './index'

describe('walking skeleton', () => {
  it('TP-5-build: exposes one core function', () => {
    expect(accountPackageId()).toBe('@comfyorg/account')
  })
})
