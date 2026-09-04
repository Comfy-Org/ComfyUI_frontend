import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'

const args = process.argv.slice(2)

const readArgument = (name) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

const readDiff = () => {
  const diffFile = readArgument('--diff-file')
  if (diffFile) return readFileSync(diffFile, 'utf8')

  return execFileSync(
    'git',
    ['diff', '--unified=0', 'origin/main...HEAD', '--', 'browser_tests'],
    { encoding: 'utf8' }
  )
}

const readPullRequestBody = () => {
  const bodyFile = readArgument('--body-file')
  if (bodyFile) return readFileSync(bodyFile, 'utf8')

  if (process.env.GITHUB_EVENT_PATH) {
    const event = JSON.parse(
      readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')
    )
    return event.pull_request?.body ?? ''
  }

  return execFileSync('gh', ['pr', 'view', '--json', 'body', '--jq', '.body'], {
    encoding: 'utf8'
  })
}

const addedSkipPattern = /^\+(?!\+\+\+).*\btest\.(?:fixme|skip)\s*\(/m
const trackingLinkPattern =
  /(?:https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:issues|pull)\/\d+|(?:^|[\s([])#\d+)/m

const diff = readDiff()
if (!addedSkipPattern.test(diff)) process.exit(0)

const body = readPullRequestBody()
if (!trackingLinkPattern.test(body)) {
  process.stderr.write(
    'Added test.fixme()/test.skip() calls in browser_tests must name the tracking issue or follow-up PR that will restore the test. Add an issue/PR link to the pull request body.\n'
  )
  process.exit(1)
}
