import { describe, expect, test } from 'vitest'

import {
  provesRefIsMissing,
  provesRequirementIsUnsatisfiable
} from './customNodeQuarantineProbe'

describe('custom-node quarantine probes', () => {
  test('accepts an explicit missing-ref response but not a network failure', () => {
    expect(
      provesRefIsMissing({
        stderr: 'fatal: remote error: upload-pack: not our ref abc123'
      })
    ).toBe(true)
    expect(
      provesRefIsMissing({ stderr: 'Could not resolve host: github.com' })
    ).toBe(false)
  })

  test('requires both the declared requirement and a resolver verdict', () => {
    const error = {
      stderr:
        'Could not find a version that satisfies the requirement Imath>=3.1.0\nNo matching distribution found for Imath>=3.1.0'
    }
    expect(provesRequirementIsUnsatisfiable(error, 'Imath>=3.1.0')).toBe(true)
    expect(provesRequirementIsUnsatisfiable(error, 'OpenEXR>=3.2.0')).toBe(
      false
    )
    expect(
      provesRequirementIsUnsatisfiable(
        { stderr: 'Temporary failure in name resolution: pypi.org' },
        'Imath>=3.1.0'
      )
    ).toBe(false)
    expect(
      provesRequirementIsUnsatisfiable(
        {
          stderr:
            'Collecting Imath>=3.1.0\nCould not find a version that satisfies the requirement Other>=1.0'
        },
        'Imath>=3.1.0'
      )
    ).toBe(false)
  })
})
