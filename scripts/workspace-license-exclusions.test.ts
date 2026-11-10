import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, onTestFinished } from 'vitest'

import { generateWorkspaceLicenseExclusions } from './workspace-license-exclusions'

function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'workspace-license-exclusions-'))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))

  function createPackage(
    relative: string,
    name: string,
    privatePackage = false
  ) {
    const path = join(directory, relative)
    mkdirSync(path, { recursive: true })
    writeFileSync(
      join(path, 'package.json'),
      JSON.stringify({ name, version: '1.0.0', private: privatePackage })
    )
    return { name, path }
  }

  return { directory, createPackage }
}

describe('workspace license exclusions', () => {
  it('excludes the root and workspace members without excluding external packages in the same scope', () => {
    const { directory, createPackage } = createFixture()
    const root = createPackage('.', '@comfyorg/frontend', true)
    const internal = createPackage('packages/internal', 'unscoped-internal')
    const external = createPackage('external', '@comfyorg/external', true)
    const linkedPath = join(directory, 'linked-internal')
    symlinkSync(internal.path, linkedPath, 'dir')

    expect(
      generateWorkspaceLicenseExclusions(
        [root, internal],
        [
          {
            ...root,
            dependencies: {
              'unscoped-internal': {
                path: linkedPath,
                dependencies: { '@comfyorg/external': external }
              }
            }
          }
        ]
      )
    ).toBe('@comfyorg/frontend;unscoped-internal')
  })

  it.for(['dependencies', 'optionalDependencies'])(
    'rejects a nested same-name same-version external package in %s even through an alias',
    (dependencyField) => {
      const { createPackage } = createFixture()
      const root = createPackage('.', '@comfyorg/frontend', true)
      const internal = createPackage('packages/internal', '@comfyorg/internal')
      const parent = createPackage('external-parent', 'external-parent')
      const collision = createPackage('external-copy', '@comfyorg/internal')

      expect(() =>
        generateWorkspaceLicenseExclusions(
          [root, internal],
          [
            {
              ...root,
              dependencies: {
                '@comfyorg/internal': internal,
                'external-parent': {
                  ...parent,
                  [dependencyField]: { 'external-alias': collision }
                }
              }
            }
          ]
        )
      ).toThrow('Cannot exclude workspace package @comfyorg/internal')
    }
  )

  it('checks children of a repeated package after a deduplicated occurrence', () => {
    const { createPackage } = createFixture()
    const root = createPackage('.', '@comfyorg/frontend', true)
    const internal = createPackage('packages/internal', '@comfyorg/internal')
    const parent = createPackage('external-parent', 'external-parent')
    const collision = createPackage('external-copy', '@comfyorg/internal')

    expect(() =>
      generateWorkspaceLicenseExclusions(
        [root, internal],
        [
          {
            ...root,
            dependencies: {
              first: parent,
              second: {
                ...parent,
                dependencies: { '@comfyorg/internal': collision }
              }
            }
          }
        ]
      )
    ).toThrow('Cannot exclude workspace package @comfyorg/internal')
  })

  it('allows absent optional packages listed by pnpm for other platforms', () => {
    const { directory, createPackage } = createFixture()
    const root = createPackage('.', '@comfyorg/frontend', true)
    writeFileSync(
      join(root.path, 'package.json'),
      JSON.stringify({
        name: root.name,
        optionalDependencies: { 'other-platform': '1.0.0' }
      })
    )

    expect(
      generateWorkspaceLicenseExclusions(
        [root],
        [
          {
            ...root,
            dependencies: {
              'other-platform': { path: join(directory, 'absent') }
            }
          }
        ]
      )
    ).toBe('@comfyorg/frontend')
  })

  it('rejects a missing required dependency instead of issuing exclusions', () => {
    const { directory, createPackage } = createFixture()
    const root = createPackage('.', '@comfyorg/frontend', true)

    expect(() =>
      generateWorkspaceLicenseExclusions(
        [root],
        [
          {
            ...root,
            dependencies: { required: { path: join(directory, 'absent') } }
          }
        ]
      )
    ).toThrow('ENOENT')
  })

  it.for(['workspace', 'production'])(
    'rejects an empty %s listing instead of generating unchecked exclusions',
    (listing) => {
      const { createPackage } = createFixture()
      const root = createPackage('.', '@comfyorg/frontend', true)
      const listings = { workspace: [root], production: [root], [listing]: [] }

      expect(() =>
        generateWorkspaceLicenseExclusions(
          listings.workspace,
          listings.production
        )
      ).toThrow()
    }
  )
})
