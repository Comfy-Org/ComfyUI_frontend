import { execSync } from 'child_process'
import { readFileSync } from 'fs'

try {
  // Create a new branch
  console.log('Creating new branch...')
  const date = new Date().toISOString().split('T')[0]
  const timestamp = new Date().getTime()
  const branchName = `update-litegraph-${date}-${timestamp}`
  execSync(`git checkout -b ${branchName} -t origin/main`, { stdio: 'inherit' })

  // Update litegraph
  console.log('Updating litegraph...')
  execSync('npm install @comfyorg/litegraph@latest', { stdio: 'inherit' })

  // Get the new version from package.json
  const packageLock = JSON.parse(readFileSync('./package-lock.json', 'utf8'))
  const newVersion =
    packageLock.packages['node_modules/@comfyorg/litegraph'].version

  // Stage changes
  execSync('git add package.json package-lock.json', { stdio: 'inherit' })
  execSync('git commit -m "chore: update litegraph to ' + newVersion + '"', {
    stdio: 'inherit'
  })

  // Create the PR
  console.log('Creating PR...')
  const prBody = `Automated update of litegraph to version ${newVersion}.
Ref: https://github.com/Comfy-Org/litegraph.js/releases/tag/v${newVersion}`
  execSync(
    `gh pr create --title "Update litegraph ${newVersion}" --label "dependencies" --body "${prBody}"`,
    { stdio: 'inherit' }
  )

  console.log(
    `✅ Successfully created PR for litegraph update to ${newVersion}`
  )
} catch (error) {
  console.error('❌ Error during update process:', error.message)
}
