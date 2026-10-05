import {
  blockedBy,
  crossOriginSessionFixture as test,
  expectStepsWritten
} from '@e2e/fixtures/crossOriginSessionFixture'

// Milestone 2 QA plan cases SS1-SS6 and SO1-SO6, restated for billing-web on
// the shared session.
test.describe(
  'Cross-origin session, billing-web handoff',
  { tag: ['@session', '@flag-on'] },
  () => {
    test.fixme(
      '[SS1] signed in on Cloud, Subscribe opens billing-web checkout with no sign-in form',
      blockedBy(
        'FE-2898 billing-web on session; C3 BE-17063, C5 BE-17066, C11 BE-17136 on testcloud'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[SS2] signed in on both, Subscribe keeps the plan and workspace the app sent',
      blockedBy('FE-2898 billing-web on session; C5 BE-17066 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      "[SS3] different accounts on billing-web and Cloud end on the session's one identity with a notice",
      blockedBy(
        'FE-2898 billing-web on session, FE-2903 account-switch notice (open question 11); a second test account'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[SS4] signing out of Cloud signs billing-web out too',
      blockedBy(
        'FE-2898 billing-web on session, FE-2897 lifecycle; C1 BE-17061 on testcloud'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[SS5] an expiring workspace token mid-checkout recovers with no sign-in prompt',
      blockedBy(
        'FE-2898 billing-web on session, FE-2895 authorize(); C5 BE-17066 on testcloud'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[SS6] a second entry link opens a second billing-web tab in its own workspace',
      blockedBy(
        'FE-2898 billing-web on session, FE-2895 workspace header; C5 BE-17066 on testcloud'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[SO1] signed out, a checkout link keeps every parameter through sign-in',
      blockedBy('FE-2898 billing-web on session; C3 BE-17063 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      '[SO2] signed out, subscription, payment-method and result links keep their parameters',
      blockedBy('FE-2898 billing-web on session; C3 BE-17063 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      '[SO3] an abandoned sign-in stays on sign-in with a way to retry',
      blockedBy('FE-2898 billing-web on session'),
      expectStepsWritten
    )

    test.fixme(
      "[SO4] signing in as a non-member shows the can't-access copy and never personal data",
      blockedBy(
        'FE-2898 billing-web on session; C5 BE-17066 on testcloud; a workspace the account is not in'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[SO5] Cloud ?workspace= while signed out opens that workspace after sign-in',
      blockedBy(
        'FE-2894 boot rules, FE-2903 Cloud lifecycle; C3 BE-17063 on testcloud'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[SO6] a malformed link while signed out shows the entry error, not sign-in',
      blockedBy('FE-2898 billing-web on session'),
      expectStepsWritten
    )
  }
)
