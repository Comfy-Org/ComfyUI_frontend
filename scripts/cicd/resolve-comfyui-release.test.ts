import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  computeTargetVersion,
  isValidSemver,
  parseRequirementsVersion,
  parseTargetBranchOverride
} from './resolve-comfyui-release'

describe('parseRequirementsVersion', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-release-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  function writeRequirements(content: string): string {
    const filePath = path.join(dir, 'requirements.txt')
    fs.writeFileSync(filePath, content)
    return filePath
  }

  it('parses a pinned == version', () => {
    const file = writeRequirements(
      'torch\ncomfyui-frontend-package==1.45.20\nnumpy'
    )
    expect(parseRequirementsVersion(file)).toBe('1.45.20')
  })

  it('parses a >= constraint', () => {
    const file = writeRequirements('comfyui-frontend-package>=2.0.3')
    expect(parseRequirementsVersion(file)).toBe('2.0.3')
  })

  it('returns null when the package is absent', () => {
    const file = writeRequirements('torch\nnumpy')
    expect(parseRequirementsVersion(file)).toBeNull()
  })

  it('returns null when the file is missing', () => {
    expect(parseRequirementsVersion(path.join(dir, 'nope.txt'))).toBeNull()
  })
})

describe('isValidSemver', () => {
  it('accepts a valid X.Y.Z', () => {
    expect(isValidSemver('1.45.20')).toBe(true)
    expect(isValidSemver('2.0.0')).toBe(true)
  })

  it('rejects non-three-part versions', () => {
    expect(isValidSemver('1.45')).toBe(false)
    expect(isValidSemver('1.45.20.1')).toBe(false)
  })

  it('rejects non-numeric or leading-zero-padded parts', () => {
    expect(isValidSemver('1.x.0')).toBe(false)
    expect(isValidSemver('v1.45.20')).toBe(false)
    expect(isValidSemver('1.045.20')).toBe(false)
  })

  it('rejects empty / non-string input', () => {
    expect(isValidSemver('')).toBe(false)
    // @ts-expect-error exercising runtime guard
    expect(isValidSemver(undefined)).toBe(false)
  })
})

describe('parseTargetBranchOverride', () => {
  it('parses core/1.47', () => {
    expect(parseTargetBranchOverride('core/1.47')).toEqual({
      major: 1,
      minor: 47,
      branch: 'core/1.47'
    })
  })

  it('parses a major bump core/2.0', () => {
    expect(parseTargetBranchOverride('core/2.0')).toEqual({
      major: 2,
      minor: 0,
      branch: 'core/2.0'
    })
  })

  it('rejects malformed overrides', () => {
    expect(parseTargetBranchOverride('core/1')).toBeNull()
    expect(parseTargetBranchOverride('1.47')).toBeNull()
    expect(parseTargetBranchOverride('core/1.47.0')).toBeNull()
    expect(parseTargetBranchOverride('release/1.47')).toBeNull()
    expect(parseTargetBranchOverride('core/v1.47')).toBeNull()
    expect(parseTargetBranchOverride('')).toBeNull()
  })
})

describe('computeTargetVersion', () => {
  it('bumps patch on a 2.x line when commits exist', () => {
    expect(computeTargetVersion(2, 0, 'v2.0.3', true)).toBe('2.0.4')
  })

  it('keeps the tag version when no new commits exist', () => {
    expect(computeTargetVersion(2, 0, 'v2.0.3', false)).toBe('2.0.3')
  })

  it('starts a fresh major.minor line at .0 when no tag exists', () => {
    expect(computeTargetVersion(2, 0, null, true)).toBe('2.0.0')
    expect(computeTargetVersion(1, 47, null, true)).toBe('1.47.0')
  })

  it('returns null for a malformed tag', () => {
    expect(computeTargetVersion(1, 47, 'v1.47', true)).toBeNull()
  })
})
