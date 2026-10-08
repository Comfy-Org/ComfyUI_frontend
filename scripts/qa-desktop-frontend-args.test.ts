import { describe, expect, it } from 'vitest'

import {
  pickBuildRun,
  pickInstall,
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

describe('pickInstall', () => {
  const local = { id: 'inst-1', name: 'Local', sourceId: 'standalone' }
  const cloud = { id: 'inst-2', name: 'Cloud', sourceId: 'cloud' }
  const portable = { id: 'inst-3', name: 'Portable', sourceId: 'portable' }

  it('takes the only local install, ignoring Cloud', () => {
    expect(pickInstall([local, cloud])).toBe(local)
  })

  it('takes the named install by id or name', () => {
    expect(pickInstall([local, portable], 'inst-3')).toBe(portable)
    expect(pickInstall([local, portable], 'Local')).toBe(local)
  })

  it.for([
    {
      name: 'several local installs',
      installs: [local, portable],
      wanted: undefined,
      message: /More than one/
    },
    {
      name: 'no match',
      installs: [local],
      wanted: 'nope',
      message: /No matching/
    }
  ])('asks for --install with $name', ({ installs, wanted, message }) => {
    expect(() => pickInstall(installs, wanted)).toThrow(message)
  })
})

describe('pickBuildRun', () => {
  const hint = (id: number) => `rerun ${id}`
  const sha = 'abcdef1234567'

  it('takes the first run that still has the build', () => {
    expect(
      pickBuildRun(
        [
          { databaseId: 3, status: 'completed', hasArtifact: false },
          { databaseId: 2, status: 'completed', hasArtifact: true }
        ],
        sha,
        hint
      )
    ).toBe(2)
  })

  it.for([
    {
      name: 'the build is still running',
      runs: [{ databaseId: 4, status: 'in_progress', hasArtifact: false }],
      message: /still running \(run 4\)/
    },
    {
      name: 'the build has expired',
      runs: [{ databaseId: 5, status: 'completed', hasArtifact: false }],
      message: /expired.*rerun 5/
    },
    {
      name: 'there is no build',
      runs: [],
      message: /No CI build found for abcdef1/
    }
  ])('explains when $name', ({ runs, message }) => {
    expect(() => pickBuildRun(runs, sha, hint)).toThrow(message)
  })
})
