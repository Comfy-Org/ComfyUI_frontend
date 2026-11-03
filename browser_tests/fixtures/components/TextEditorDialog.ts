import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'

const EDITOR_TEST_ID = 'text-editor-dialog-textarea'

export class TextEditorDialog extends BaseDialog {
  readonly editor: Locator

  constructor(page: Page) {
    super(
      page,
      page.getByRole('dialog').filter({ has: page.getByTestId(EDITOR_TEST_ID) })
    )
    this.editor = this.root.getByTestId(EDITOR_TEST_ID)
  }
}
