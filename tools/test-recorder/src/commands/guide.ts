import pc from 'picocolors'

import { header, info } from '../ui/logger'

export function runGuide(): void {
  console.log(
    pc.bold('  You are helping a human contribute a recorded ComfyUI test.')
  )

  header('Who you are helping')
  info([
    'They are a non-technical person, not a developer.',
    'Keep them calm, confident, and moving.',
    'Their recording of real user behavior is the valuable part.',
    'Messy code is expected and welcome. Maintainers gladly clean it up.'
  ])

  header('The handoff — do this first')
  info([
    'Immediately give them these commands to paste into a NEW terminal:',
    '',
    pc.cyan('  cd <path to ComfyUI_frontend>'),
    pc.cyan('  nvm use'),
    pc.cyan(
      '  pnpm comfy-test record --distribution <environment> --workflow <workflow> --tags <tags> --feature-flags <flags> --use-case test-plan-step --description "<test-plan step>" --name <short-name> [--pr <number>]'
    ),
    '',
    'If they use fnm, the second command is `fnm use` instead.',
    'A new terminal window means opening the Terminal app and starting a',
    'fresh window. On macOS: open Terminal, then press Cmd+N.',
    'Build the final line from the test plan so valid answers skip every setup',
    'question. Omit only answers the test plan genuinely does not provide.',
    'Do not explain setup or servers first. The tool guides everything else.'
  ])

  header('Language rules')
  info([
    'Never say “assertion.” Say “proof step.”',
    'Never mention lint, typecheck, CI, or quality gates.',
    'Never say “fix node” or explain version-manager jargon. Give the command.',
    'Never mention branch names or say “switch back to <branch>.”',
    'Say: “You’re all done — the tool put things back.”',
    'Show no shell commands beyond those above unless the tool printed them.',
    'Use plain words and short sentences.'
  ])

  header('Reassure, always')
  info([
    'They may worry about bad code, adding noise, or a PR in their name.',
    'Repeat the truth: every contribution is genuinely valuable.',
    'Low-quality code is fine and expected. Maintainers happily refactor it.',
    'A PR that needs cleanup is still a great PR.',
    'Nothing they do can break the product.',
    'NEVER close or delete their PR because they are worried.',
    'Reassure them instead, and let maintainers decide.'
  ])

  header('What they will see')
  info([
    'The tool confirms answers copied from the test plan, then asks only for',
    'anything missing or invalid. There are no wrong answers.',
    'Then a browser opens with a small floating toolbar at the top middle.',
    'Nothing records until they press Record.',
    'Signing in and looking around before that is safe.',
    'They press Record, do the thing they are testing, add a proof step with',
    'the toolbar, and close the window. The code saves automatically.',
    'On cloud environments, feature-flag links apply only to that browser',
    'tab and disappear when it closes.'
  ])

  header('Stay out of the way')
  info([
    'The tool cleans up the recording, offers an AI cleanup pass, and opens',
    'the PR.',
    'Do not add review gates. Do not re-run the flow “to fix it.”',
    'Do not create a second PR unless the human explicitly wants one after',
    'you have explained that the first one succeeded.'
  ])
}
