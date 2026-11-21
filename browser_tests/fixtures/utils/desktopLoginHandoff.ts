import type { DesktopLoginCodeRedeemResponse } from '@comfyorg/ingest-types'
import type { Page } from '@playwright/test'

export const DESKTOP_LOGIN_HANDOFF_URL =
  '/?desktop_login_code=dlc_e2eApprovalCodeFE2808abcdefghijklmnopqrstu'

export async function fulfillDesktopLoginRedeem(page: Page): Promise<void> {
  await page.route('**/api/auth/desktop-login-codes/redeem', (route) =>
    route.fulfill({
      status: 200,
      json: { status: 'redeemed' } satisfies DesktopLoginCodeRedeemResponse
    })
  )
}
