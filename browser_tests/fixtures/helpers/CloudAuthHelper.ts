import type { Page } from '@playwright/test'

import {
  FIREBASE_APP_NAME,
  FIREBASE_WEB_API_KEY,
  seedFirebaseAuthUser
} from '@e2e/fixtures/helpers/firebaseAuthStorage'

/**
 * Mocks Firebase authentication for cloud E2E tests.
 *
 * The cloud build's router guard waits for Firebase `onAuthStateChanged`
 * to fire, then checks `getAuthHeader()`. In CI no Firebase project is
 * configured, so the user is never authenticated and the app redirects
 * to `/cloud/login`.
 *
 * This helper seeds Firebase's IndexedDB persistence layer with a mock
 * user and intercepts the Firebase REST APIs (securetoken, identitytoolkit)
 * so the SDK believes a user is signed in. Must be called before navigation.
 * For a REAL session against a live Cloud backend (no interception), see
 * `smokeAuth.ts`.
 */
export class CloudAuthHelper {
  private readonly appUrl: string

  constructor(private readonly page: Page) {
    this.appUrl = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
  }

  /**
   * Set up all auth mocks. Must be called before `comfyPage.setup()`.
   */
  async mockAuth(): Promise<void> {
    await this.seedFirebaseIndexedDB()
    await this.mockFirebaseEndpoints()
  }

  /**
   * Seed Firebase's IndexedDB persistence with the mock user (see
   * `firebaseAuthStorage.ts` for the shared db/store/key contract).
   */
  private async seedFirebaseIndexedDB(): Promise<void> {
    await seedFirebaseAuthUser(this.page, this.appUrl, {
      uid: 'test-user-e2e',
      email: 'e2e@test.comfy.org',
      displayName: 'E2E Test User',
      emailVerified: true,
      isAnonymous: false,
      providerData: [
        {
          providerId: 'google.com',
          uid: 'test-user-e2e',
          displayName: 'E2E Test User',
          email: 'e2e@test.comfy.org',
          phoneNumber: null,
          photoURL: null
        }
      ],
      stsTokenManager: {
        refreshToken: 'mock-refresh-token',
        accessToken: 'mock-firebase-id-token',
        expirationTime: Date.now() + 60 * 60 * 1000
      },
      apiKey: FIREBASE_WEB_API_KEY,
      appName: FIREBASE_APP_NAME
    })
  }

  /**
   * Intercept Firebase Auth REST API endpoints so the SDK can
   * "refresh" the mock user's token without real credentials.
   */
  private async mockFirebaseEndpoints(): Promise<void> {
    await this.page.route('**/securetoken.googleapis.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          expires_in: '3600',
          token_type: 'Bearer',
          refresh_token: 'mock-refresh-token',
          id_token: 'mock-firebase-id-token',
          user_id: 'test-user-e2e',
          project_id: 'dreamboothy-dev'
        })
      })
    )

    await this.page.route('**/identitytoolkit.googleapis.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'identitytoolkit#GetAccountInfoResponse',
          users: [
            {
              localId: 'test-user-e2e',
              email: 'e2e@test.comfy.org',
              displayName: 'E2E Test User',
              emailVerified: true,
              validSince: '0',
              lastLoginAt: String(Date.now()),
              createdAt: String(Date.now()),
              lastRefreshAt: new Date().toISOString()
            }
          ]
        })
      })
    )

    await this.page.route('**/__/auth/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body></body></html>'
      })
    )
  }
}
