import { describe, expect, it } from 'vitest'

import packData from '../../browser_tests/fixtures/data/nodes2AcceptancePacks.json' with { type: 'json' }

import { applyInitStub, extraPythonModules } from './setupPacks'

const replaceInstall = {
  reason: 'installs into the Python environment',
  replace: { from: '\ninstallNodes()\n', to: '\npass\n' }
}

describe('applyInitStub', () => {
  it('replaces the original with the stub source', () => {
    expect(
      applyInitStub('import heavy\n', {
        reason: 'heavy imports',
        source: ['from .node import Node', 'NODE_CLASS_MAPPINGS = {}']
      })
    ).toBe('from .node import Node\nNODE_CLASS_MAPPINGS = {}\n')
  })

  it('applies the replacement to the original', () => {
    expect(
      applyInitStub(
        'def installNodes(): ...\ninstallNodes()\nrest\n',
        replaceInstall
      )
    ).toBe('def installNodes(): ...\npass\nrest\n')
  })

  it('leaves an already patched file unchanged, so setup can be re-run', () => {
    const patched = 'def installNodes(): ...\npass\nrest\n'

    expect(applyInitStub(patched, replaceInstall)).toBe(patched)
  })

  it('fails when the text to replace is gone, rather than running the pack unpatched', () => {
    expect(() => applyInitStub('something else\n', replaceInstall)).toThrow(
      'installNodes()'
    )
  })
})

describe('extraPythonModules', () => {
  it('lists each module the pinned packs need once', () => {
    const modules = extraPythonModules(packData.packs)

    expect(modules).toEqual([...new Set(modules)])
    expect(modules).toContain('watchdog')
  })

  it('gives every pinned stub either a source or a replacement', () => {
    const stubs = packData.packs.flatMap((pack) =>
      pack.initStub ? [pack.initStub] : []
    )

    expect(stubs.every((stub) => 'source' in stub || 'replace' in stub)).toBe(
      true
    )
  })
})
