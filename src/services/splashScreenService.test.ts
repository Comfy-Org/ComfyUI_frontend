import { beforeEach, describe, expect, it } from 'vitest'

import { hideSplashScreen } from './splashScreenService'

describe('hideSplashScreen', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="splash-loader"></div>'
  })

  it('is safe to call after the splash is already gone', () => {
    hideSplashScreen()
    hideSplashScreen()

    expect(document.getElementById('splash-loader')).toBeNull()
  })
})
