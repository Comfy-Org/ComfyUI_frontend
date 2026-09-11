import type { Page } from '@playwright/test'

/**
 * The identity `mockAuth()` signs the cloud app in as. Specs arranging
 * workspace members must use this email for the self-row so owner/member
 * gates resolve against the signed-in user.
 */
export const CLOUD_SELF_EMAIL = 'e2e@test.comfy.org'

/** A Firebase-shaped error one accounts:* REST call can be forced to return. */
export interface LiveAuthErrorCase {
  readonly code: number
  readonly message: string
}

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
   * Navigate to a lightweight same-origin page to seed Firebase's
   * IndexedDB persistence with a mock user. This ensures the data
   * is written before the app loads and Firebase reads it.
   *
   * Firebase auth uses `browserLocalPersistence` which stores data in
   * IndexedDB database `firebaseLocalStorageDb`, object store
   * `firebaseLocalStorage`, keyed by `firebase:authUser:<apiKey>:<appName>`.
   */
  private async seedFirebaseIndexedDB(): Promise<void> {
    // Navigate to a lightweight endpoint to get a same-origin context
    await this.page.goto(`${this.appUrl}/api/users`)

    await this.page.evaluate((selfEmail) => {
      const MOCK_USER_DATA = {
        uid: 'test-user-e2e',
        email: selfEmail,
        displayName: 'E2E Test User',
        emailVerified: true,
        isAnonymous: false,
        providerData: [
          {
            providerId: 'google.com',
            uid: 'test-user-e2e',
            displayName: 'E2E Test User',
            email: selfEmail,
            phoneNumber: null,
            photoURL: null
          }
        ],
        stsTokenManager: {
          refreshToken: 'mock-refresh-token',
          accessToken: 'mock-firebase-id-token',
          expirationTime: Date.now() + 60 * 60 * 1000
        },
        apiKey: 'AIzaSyDa_YMeyzV0SkVe92vBZ1tVikWBmOU5KVE',
        appName: '[DEFAULT]'
      }

      const DB_NAME = 'firebaseLocalStorageDb'
      const STORE_NAME = 'firebaseLocalStorage'
      const KEY = `firebase:authUser:${MOCK_USER_DATA.apiKey}:${MOCK_USER_DATA.appName}`

      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME)
        request.onerror = () => reject(request.error)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME)
          }
        }
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.close()
            const upgradeReq = indexedDB.open(DB_NAME, db.version + 1)
            upgradeReq.onerror = () => reject(upgradeReq.error)
            upgradeReq.onupgradeneeded = () => {
              const upgradedDb = upgradeReq.result
              if (!upgradedDb.objectStoreNames.contains(STORE_NAME)) {
                upgradedDb.createObjectStore(STORE_NAME)
              }
            }
            upgradeReq.onsuccess = () => {
              const upgradedDb = upgradeReq.result
              const tx = upgradedDb.transaction(STORE_NAME, 'readwrite')
              tx.objectStore(STORE_NAME).put(
                { fpiVersion: '1', value: MOCK_USER_DATA },
                KEY
              )
              tx.oncomplete = () => {
                upgradedDb.close()
                resolve()
              }
              tx.onerror = () => reject(tx.error)
            }
            return
          }
          const tx = db.transaction(STORE_NAME, 'readwrite')
          tx.objectStore(STORE_NAME).put(
            { fpiVersion: '1', value: MOCK_USER_DATA },
            KEY
          )
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      })
    }, CLOUD_SELF_EMAIL)
  }

  /**
   * Intercept Firebase Auth REST API endpoints so the SDK can
   * "refresh" the mock user's token without real credentials.
   */
  async mockFirebaseEndpoints(email = CLOUD_SELF_EMAIL): Promise<void> {
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
              email,
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

  /**
   * Mocks a *live* email/password sign-in: the app boots signed out, and a
   * later `accounts:signInWithPassword` call from the real sign-in form
   * succeeds against this identity. Unlike `mockAuth()`, this does not seed
   * IndexedDB, so the dialog's Firebase listener starts with no user and the
   * spec must actually submit the form to authenticate.
   */
  async mockLiveEmailSignIn(
    email = CLOUD_SELF_EMAIL,
    displayName = 'E2E Test User'
  ): Promise<void> {
    const uid = 'test-user-e2e'
    await this.page.route(
      '**/identitytoolkit.googleapis.com/**',
      async (route) => {
        const url = route.request().url()

        if (url.includes('accounts:signInWithPassword')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              kind: 'identitytoolkit#VerifyPasswordResponse',
              localId: uid,
              email,
              displayName,
              idToken: 'mock-firebase-id-token',
              registered: true,
              refreshToken: 'mock-refresh-token',
              expiresIn: '3600'
            })
          })
          return
        }

        if (url.includes('accounts:lookup')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              kind: 'identitytoolkit#GetAccountInfoResponse',
              users: [
                {
                  localId: uid,
                  email,
                  displayName,
                  emailVerified: true,
                  validSince: '0',
                  lastLoginAt: String(Date.now()),
                  createdAt: String(Date.now())
                }
              ]
            })
          })
          return
        }

        await route.fallback()
      }
    )

    await this.page.route('**/securetoken.googleapis.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-firebase-id-token',
          expires_in: '3600',
          token_type: 'Bearer',
          refresh_token: 'mock-refresh-token',
          id_token: 'mock-firebase-id-token',
          user_id: uid,
          project_id: 'dreamboothy-dev'
        })
      })
    )
  }

  /** Forces `accounts:signInWithPassword` to fail with a specific Firebase error code. */
  async mockLiveEmailSignInFailure({
    code,
    message
  }: LiveAuthErrorCase): Promise<void> {
    await this.page.route(
      '**/identitytoolkit.googleapis.com/**',
      async (route) => {
        const url = route.request().url()
        if (!url.includes('accounts:signInWithPassword')) {
          return route.fallback()
        }
        await route.fulfill({
          status: code,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code, message, errors: [{ message, reason: 'invalid' }] }
          })
        })
      }
    )
  }

  /**
   * Aborts `accounts:signInWithPassword` at the connection level, the way a
   * dropped network actually fails: no response body, just a failed fetch.
   * The Firebase SDK maps that to `auth/network-request-failed`, distinct
   * from `mockLiveEmailSignInFailure`'s REST-error-body codes.
   */
  async mockLiveEmailSignInTransportFailure(): Promise<void> {
    await this.page.route(
      '**/identitytoolkit.googleapis.com/**',
      async (route) => {
        const url = route.request().url()
        if (!url.includes('accounts:signInWithPassword')) {
          return route.fallback()
        }
        await route.abort('failed')
      }
    )
  }

  /** Forces `accounts:signUp` to fail with a specific Firebase error code. */
  async mockLiveEmailSignUpFailure({
    code,
    message
  }: LiveAuthErrorCase): Promise<void> {
    await this.page.route(
      '**/identitytoolkit.googleapis.com/**',
      async (route) => {
        const url = route.request().url()
        if (!url.includes('accounts:signUp')) {
          return route.fallback()
        }
        await route.fulfill({
          status: code,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code, message, errors: [{ message, reason: 'invalid' }] }
          })
        })
      }
    )
  }

  /**
   * Mocks a *live* sign-up (`accounts:signUp`), then the customer
   * provisioning POST the app fires immediately after account creation.
   * The app boots signed out; the spec drives the sign-up form for real.
   */
  async mockLiveEmailSignUp(
    email = CLOUD_SELF_EMAIL,
    displayName = 'E2E Test User'
  ): Promise<void> {
    const uid = 'test-user-e2e-new'
    await this.page.route(
      '**/identitytoolkit.googleapis.com/**',
      async (route) => {
        const url = route.request().url()

        if (url.includes('accounts:signUp')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              kind: 'identitytoolkit#SignupNewUserResponse',
              localId: uid,
              email,
              idToken: 'mock-firebase-id-token-new',
              refreshToken: 'mock-refresh-token-new',
              expiresIn: '3600'
            })
          })
          return
        }

        if (url.includes('accounts:lookup')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              kind: 'identitytoolkit#GetAccountInfoResponse',
              users: [
                {
                  localId: uid,
                  email,
                  displayName,
                  emailVerified: false,
                  validSince: '0',
                  lastLoginAt: String(Date.now()),
                  createdAt: String(Date.now())
                }
              ]
            })
          })
          return
        }

        await route.fallback()
      }
    )

    await this.page.route('**/securetoken.googleapis.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-firebase-id-token-new',
          expires_in: '3600',
          token_type: 'Bearer',
          refresh_token: 'mock-refresh-token-new',
          id_token: 'mock-firebase-id-token-new',
          user_id: uid,
          project_id: 'dreamboothy-dev'
        })
      })
    )

    // Both hosts call POST /customers right after account creation to
    // provision the billing record. A 201 keeps the sign-up flow from
    // rolling the just-created Firebase user back out.
    await this.page.route('**/customers', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'test-customer-e2e' })
      })
    })
  }

  /** Forces the sign-up form's customer provisioning POST to fail. */
  async mockLiveEmailSignUpProvisioningFailure(status = 500): Promise<void> {
    await this.page.route('**/customers', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'provisioning failed' })
      })
    })
  }

  /**
   * Mocks the `accounts:sendOobCode` password-reset request. Firebase
   * answers success identically whether or not the email is registered
   * (an enumeration-safety property both hosts rely on), so this alone
   * cannot distinguish the two — pair it with a UI assertion instead.
   */
  async mockLivePasswordReset(): Promise<void> {
    await this.page.route(
      '**/identitytoolkit.googleapis.com/**',
      async (route) => {
        const url = route.request().url()
        if (!url.includes('accounts:sendOobCode')) return route.fallback()
        const body = route.request().postDataJSON() as { email?: string }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            kind: 'identitytoolkit#GetOobConfirmationCodeResponse',
            email: body.email
          })
        })
      }
    )
  }

  /**
   * Aborts `accounts:sendOobCode` at the connection level, the way a dropped
   * network actually fails: the Firebase SDK maps it to
   * `auth/network-request-failed`, a real transport failure rather than a
   * REST error body. Enumeration safety means the endpoint answers success
   * either way, so only a transport failure exercises the reset error path.
   */
  async mockLivePasswordResetTransportFailure(): Promise<void> {
    await this.page.route(
      '**/identitytoolkit.googleapis.com/**',
      async (route) => {
        const url = route.request().url()
        if (!url.includes('accounts:sendOobCode')) return route.fallback()
        await route.abort('failed')
      }
    )
  }
}
