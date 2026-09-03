// @vitest-environment happy-dom
import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import { safeReturnPath, useSignInHref } from './useSignInHref'

describe('safeReturnPath', () => {
  it('keeps same-origin paths only', () => {
    expect(safeReturnPath('/workshop/models/kling-ai/', '/')).toBe(
      '/workshop/models/kling-ai/'
    )
    expect(safeReturnPath('/workshop/?q=1', '/')).toBe('/workshop/?q=1')
    expect(safeReturnPath(null, '/workshop')).toBe('/workshop')
    expect(safeReturnPath('https://evil.example', '/')).toBe('/')
    expect(safeReturnPath('//evil.example', '/')).toBe('/')
    expect(safeReturnPath('/\\evil.example', '/')).toBe('/')
    expect(safeReturnPath('/\t/evil.example', '/')).toBe('/')
    expect(safeReturnPath('/\n/evil.example', '/')).toBe('/')
    expect(safeReturnPath('/\r/evil.example', '/')).toBe('/')
    expect(safeReturnPath('workshop', '/')).toBe('/')
  })
})

describe('useSignInHref', () => {
  it('points the sign-in page back at the current location once mounted', async () => {
    history.replaceState(null, '', '/workshop/models/demo/?tab=api')
    let href!: ReturnType<typeof useSignInHref>
    render(
      defineComponent({
        setup() {
          href = useSignInHref()
          return () => h('div')
        }
      })
    )
    await nextTick()
    expect(href.value).toBe(
      '/workshop/sign-in?return=%2Fworkshop%2Fmodels%2Fdemo%2F%3Ftab%3Dapi'
    )
  })
})
