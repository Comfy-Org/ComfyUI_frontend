import { expect, it } from 'vitest'
import { isVfxV3Path, vfxNavCloudHref } from './vfxNavCampaign'

const TRACKED =
  'https://cloud.comfy.org/?utm_source=comfy_org&utm_medium=website&utm_campaign=free_tier&utm_content=nav_try_cloud'
it.for(['/solutions/vfx/v3/', '/solutions/vfx/v3', '/zh-CN/solutions/vfx/v3/'])(
  'removes only nav UTMs on %s',
  (path) => {
    expect(isVfxV3Path(path)).toBe(true)
    expect(vfxNavCloudHref(path)).toBe('https://cloud.comfy.org/')
  }
)
it.for([
  '/',
  '/solutions/vfx/',
  '/zh-CN/solutions/vfx/',
  '/pricing/',
  '/solutions/vfx/v3/extra/'
])('keeps existing nav attribution on %s', (path) => {
  expect(isVfxV3Path(path)).toBe(false)
  expect(vfxNavCloudHref(path)).toBe(TRACKED)
})
it('preserves functional parameters and fragments while removing UTM variants', () => {
  expect(
    vfxNavCloudHref(
      '/solutions/vfx/v3/',
      'https://cloud.comfy.org/?share=keep&feature=one&utm_source=linkedin&UTM_ID=paid#open'
    )
  ).toBe('https://cloud.comfy.org/?share=keep&feature=one#open')
})
