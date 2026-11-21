import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, onTestFinished } from 'vitest'

import { generateWorkspaceLicenseExclusions } from './workspace-license-exclusions'

function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'workspace-license-exclusions-'))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))

  function createPackage(
    relative: string,
    name: string,
    privatePackage = false,
    manifest: Record<string, unknown> = {}
  ) {
    const path = join(directory, relative)
    mkdirSync(path, { recursive: true })
    writeFileSync(
      join(path, 'package.json'),
      JSON.stringify({
        name,
        version: '1.0.0',
        private: privatePackage,
        ...manifest
      })
    )
    return { name, path }
  }

  return { directory, createPackage }
}

describe('workspace license exclusions', () => {
  it.for([
    {
      edge: 'nested alias',
      parentDirectory: 'fixtures/parent',
      parentReference: 'file:fixtures/parent',
      parentManifest: {
        dependencies: { alias: 'file:../../external' }
      },
      expected: 'fixture-member;fixture-root'
    },
    {
      edge: 'installed optional peer supplied through devDependencies',
      parentDirectory: 'packages/parent',
      parentReference: 'workspace:*',
      parentManifest: {
        devDependencies: { 'fixture-collision': 'file:../../external' },
        peerDependencies: { 'fixture-collision': '*' },
        peerDependenciesMeta: {
          'fixture-collision': { optional: true }
        }
      },
      expected: 'fixture-member;fixture-parent;fixture-root'
    }
  ])(
    'CLI rejects a same-version external collision through $edge',
    (scenario) => {
      const { directory, createPackage } = createFixture()
      writeFileSync(
        join(directory, 'pnpm-workspace.yaml'),
        'packages:\n  - packages/*\n'
      )
      createPackage('.', 'fixture-root', true, {
        dependencies: { 'fixture-parent': scenario.parentReference },
        devDependencies: { 'fixture-collision': 'file:external' }
      })
      createPackage('packages/collision', 'fixture-collision', true)
      createPackage(
        scenario.parentDirectory,
        'fixture-parent',
        true,
        scenario.parentManifest
      )
      createPackage('external', 'fixture-collision', false, {
        license: 'UNLICENSED'
      })
      const install = spawnSync(
        'pnpm',
        ['install', '--offline', '--ignore-scripts'],
        { cwd: directory, encoding: 'utf8' }
      )
      expect(install).toMatchObject({ status: 0 })
      const args = [
        '--import',
        fileURLToPath(import.meta.resolve('tsx')),
        fileURLToPath(
          new URL('./workspace-license-exclusions.ts', import.meta.url)
        )
      ]
      const options = { cwd: directory, encoding: 'utf8' } as const

      const collision = spawnSync(process.execPath, args, options)

      expect(collision.status).toBe(1)
      expect(collision.stdout).toBe('')
      expect(collision.stderr).toContain(
        'Cannot exclude workspace package fixture-collision'
      )

      createPackage('packages/collision', 'fixture-member', true)
      const distinct = spawnSync(process.execPath, args, options)

      expect(distinct).toMatchObject({ status: 0 })
      expect(distinct.stdout).toBe(scenario.expected)
    }
  )

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

  it('allows absent optional peers but rejects absent required peers', () => {
    const { createPackage } = createFixture()
    const root = createPackage('.', 'fixture-root', true, {
      peerDependencies: { absent: '*' },
      peerDependenciesMeta: { absent: { optional: true } }
    })

    expect(generateWorkspaceLicenseExclusions([root], [root])).toBe(
      'fixture-root'
    )

    createPackage('.', 'fixture-root', true, {
      peerDependencies: { absent: '*' }
    })

    expect(() => generateWorkspaceLicenseExclusions([root], [root])).toThrow(
      'ENOENT'
    )
  })

  it('checks production descendants of an installed peer even across a peer cycle', () => {
    const { directory, createPackage } = createFixture()
    const root = createPackage('.', 'fixture-root', true, {
      peerDependencies: { provider: '*' }
    })
    const internal = createPackage('packages/internal', 'collision')
    createPackage('node_modules/provider', 'provider', false, {
      peerDependencies: { 'fixture-root': '*' },
      dependencies: { alias: '1.0.0' }
    })
    createPackage('node_modules/provider/node_modules/alias', 'collision')
    symlinkSync(directory, join(directory, 'node_modules/fixture-root'), 'dir')

    expect(() =>
      generateWorkspaceLicenseExclusions([root, internal], [root])
    ).toThrow('Cannot exclude workspace package collision')
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
