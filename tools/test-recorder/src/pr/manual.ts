import { info } from '../ui/logger'

interface ManualPrOptions {
  testFilePath: string
  testName: string
  relativePath: string
  repoUrl?: string
}

const DEFAULT_REPO = 'https://github.com/Comfy-Org/ComfyUI_frontend'

export function printManualInstructions(options: ManualPrOptions): void {
  const repo = options.repoUrl ?? DEFAULT_REPO

  info([
    'Create a PR manually:',
    '',
    `  1. Go to: ${repo}`,
    '  2. Click "Add file" → "Create new file"',
    `  3. Set path to: ${options.relativePath}`,
    '  4. Paste the contents (copied to your clipboard ✅)',
    `  5. Write commit message: "test: add ${options.testName} e2e test"`,
    '  6. Select "Create a new branch" → click "Propose new file"',
    '  7. Click "Create pull request"',
    '',
    'Or, ask an AI agent: "Create a PR with this test file"',
    `(The file is at ${options.testFilePath})`
  ])
}
