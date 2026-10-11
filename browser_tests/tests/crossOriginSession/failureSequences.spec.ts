import {
  blockedBy,
  crossOriginSessionFixture as test,
  expectStepsWritten
} from '@e2e/fixtures/crossOriginSessionFixture'

// Ids follow the TDD's failure-sequence table. FS-03, FS-04, FS-05, FS-16 and
// FS-17 are backend races and load cases a browser cannot observe.
test.describe(
  'Cross-origin session, failure sequences',
  { tag: ['@session', '@flag-on'] },
  () => {
    test.fixme(
      '[FS-01] after sign out, a site with a remembered Firebase login on the old build does not silently restore',
      blockedBy(
        'FE-2894 boot rules; C1 BE-17061 revoked-cookie rule on testcloud'
      ),
      expectStepsWritten
    )

    test.fixme(
      "[FS-02] signing out while an old-build tab refreshes its login refuses that tab's create call",
      blockedBy('FE-2903 Cloud lifecycle; C1 BE-17061 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      '[FS-06] two sites creating sessions with out-of-order responses end on one identity, and the losing site recovers on its next write',
      blockedBy(
        'FE-2897 lifecycle, FE-2903 Cloud lifecycle, FE-2898 billing-web; C1 BE-17061 on testcloud'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[FS-07] a same-origin session read with no Origin header works',
      blockedBy('FE-2892 web session client; C3 BE-17063 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      '[FS-08] an untrusted PR preview page gets nothing readable from an authenticated GET with the cookie',
      blockedBy('C0 BE-17071 and C5 BE-17066 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      '[FS-09] a link from another site opens a short link or the OAuth consent page',
      blockedBy(
        'C5 BE-17066 link-click exception on testcloud; target a real short link and the consent page'
      ),
      expectStepsWritten
    )

    test.fixme(
      "[FS-10] with Alice's cookie and Bob's Authorization header, the header credential is used and an invalid one fails",
      blockedBy(
        'FE-2895 authorize(); C5 BE-17066 on testcloud; a second test account for the valid-header half'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[FS-11] a revoked new cookie with a valid old Firebase cookie is refused',
      blockedBy('C1 BE-17061 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      '[FS-12] after sign out of all devices, a tab with a remembered Firebase login cannot create a session',
      blockedBy('FE-2897 lifecycle; C2 BE-17064 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      '[FS-13] an account change during CSRF recovery abandons the write',
      blockedBy(
        'FE-2895 authorize(), FE-2904 API client; C5 BE-17066 on testcloud; a second test account to switch to'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[FS-14] losing workspace access during a write returns 403 with no replay in the personal workspace',
      blockedBy('FE-2904 API client; C5 BE-17066 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      "[FS-15] removing a member closes that member's open socket",
      blockedBy('FE-2905 socket on session; C6 BE-17067 on testcloud'),
      expectStepsWritten
    )

    test.fixme(
      '[FS-18] a PR preview page posting to the custom-node proxy with the cookie is refused',
      blockedBy(
        'C0 BE-17071 and C5 BE-17066 on testcloud; swap in the custom-node proxy route once C5 names it'
      ),
      expectStepsWritten
    )

    test.fixme(
      '[FS-19] browser restart, restored tabs, cleared storage and a lapsed session behave the same (Chromium)',
      blockedBy(
        'FE-2894 boot rules, FE-2897 heartbeat; C1 BE-17061 on testcloud; other browsers and Desktop stay manual'
      ),
      expectStepsWritten
    )
  }
)
