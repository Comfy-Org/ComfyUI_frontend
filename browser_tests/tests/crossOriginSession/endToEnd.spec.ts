import {
  blockedBy,
  crossOriginSessionFixture as test,
  expectStepsWritten
} from '@e2e/fixtures/crossOriginSessionFixture'

test.describe(
  'Cross-origin session, section 17 end to end',
  { tag: ['@session', '@flag-on'] },
  () => {
    test.fixme(
      '[E2E-01] sign in on Cloud, arrive signed in on the website with zero Firebase calls there',
      blockedBy(
        'FE-2896 website header, FE-2894 boot rules; C3 BE-17063 and C11 BE-17136 on testcloud'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[E2E-02] sign in on the website, arrive signed in on Cloud with zero Firebase calls there',
      blockedBy(
        'FE-2897 create on sign-in, FE-2903 Cloud lifecycle; C1 BE-17061 and C3 BE-17063 on testcloud'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[E2E-03] two tabs stay in two different workspaces',
      blockedBy('FE-2904 workspace header; C5 BE-17066 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      '[E2E-04] team-workspace media loads from that workspace',
      blockedBy('FE-2905 media workspace_id; C7 BE-17068 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      '[E2E-05] sign out on one site, the other site signs out and its socket closes',
      blockedBy(
        'FE-2897 lifecycle, FE-2903 Cloud lifecycle, FE-2905 socket; C6 BE-17067 on testcloud'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[E2E-06] a user removed from a workspace is refused on the next request and the UI falls back',
      blockedBy('FE-2904 403 handling; C5 BE-17066 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      "[E2E-07] sign out of all devices ends every site's session",
      blockedBy('FE-2897 lifecycle; C2 BE-17064 revoke-all on testcloud'),
      expectStepsWritten
    )
  }
)

test.describe(
  'Cross-origin session, section 17 end to end, flag off',
  { tag: ['@session', '@flag-off'] },
  () => {
    test.fixme(
      '[E2E-08] flag off, every app behaves exactly as today',
      blockedBy(
        'FE-2891 flag reader (#18708) and the apps reading it (FE-2894, FE-2903); HARNESS-01 covers the baseline until then'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[E2E-09] an already signed-in user crosses each rollout step without being signed out',
      blockedBy(
        'FE-2903 Cloud lifecycle, FE-2907 rollout steps; C1 BE-17061, C3 BE-17063 and BE-17135 on testcloud'
      ),
      expectStepsWritten
    )
  }
)
