import { describe, expect, it } from 'vitest'

import { SESSION_SUCCESS_MESSAGES } from '@comfyorg/account/core'

import { hasKey, t } from './translations'

const SHARED_COPY: ReadonlyArray<readonly [string, string]> = [
  ['auth.signIn.signedInHeading', SESSION_SUCCESS_MESSAGES.signedInHeading],
  ['auth.signIn.signedInAs', SESSION_SUCCESS_MESSAGES.signedInAs]
]

describe('auth copy stays in step with the shared source', () => {
  it.for(SHARED_COPY)(
    '%s matches the cloud-extracted copy',
    ([key, shared]) => {
      if (!hasKey(key)) {
        throw new Error(`translations.ts has no entry for ${key}`)
      }
      expect(
        t(key),
        "both surfaces speak the cloud app's shipped copy; edits go to the shared table first"
      ).toBe(shared)
    }
  )
})
