import { describe, expect, it } from 'vitest'

import {
  splitLaunchArgs,
  withFrontendRoot,
  withoutFrontendOverride
} from './qa-desktop-frontend-args'

describe('splitLaunchArgs', () => {
  it('keeps a quoted value with spaces as one token', () => {
    expect(
      splitLaunchArgs('--enable-manager --front-end-root "/a b/dist" --x 1')
    ).toEqual(['--enable-manager', '--front-end-root', '/a b/dist', '--x', '1'])
  })
})

describe('withFrontendRoot', () => {
  it.for([
    {
      name: 'adds the override to plain args',
      args: '--enable-manager',
      expected: '--enable-manager --front-end-root /qa/pr-1'
    },
    {
      name: 'replaces an existing quoted root',
      args: '--enable-manager --front-end-root "/old dir/dist" --listen',
      expected: '--enable-manager --listen --front-end-root /qa/pr-1'
    },
    {
      name: 'replaces a --front-end-version override',
      args: '--front-end-version Comfy-Org/ComfyUI_frontend@1.56.2',
      expected: '--front-end-root /qa/pr-1'
    },
    {
      name: 'replaces an equals-form override',
      args: '--front-end-root=/old --cpu',
      expected: '--cpu --front-end-root /qa/pr-1'
    }
  ])('$name', ({ args, expected }) => {
    expect(withFrontendRoot(args, '/qa/pr-1')).toBe(expected)
  })

  it('quotes a root that contains spaces', () => {
    expect(withFrontendRoot('', '/Users/qa/Comfy QA/pr-1')).toBe(
      '--front-end-root "/Users/qa/Comfy QA/pr-1"'
    )
  })
})

describe('withoutFrontendOverride', () => {
  it('removes the override and keeps every other arg', () => {
    expect(
      withoutFrontendOverride(
        '--enable-manager --front-end-root "/a b" --comfy-api-base https://x'
      )
    ).toBe('--enable-manager --comfy-api-base https://x')
  })
})
