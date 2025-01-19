import { execSync } from 'child_process'
import { readFileSync } from 'fs'

const packageName = '@comfyorg/comfyui-electron-types'
const description = 'desktop API types'

try {
  // Create a new branch
  console.log('Creating new branch...')
  const date = new Date()
  const isoDate = date.toISOString().split('T')[0]
  const timestamp = date.getTime()
  const branchName = `update-electron-types-${isoDate}-${timestamp}`
  execSync(`git checkout -b ${branchName} -t origin/main`, { stdio: 'inherit' })

  // Update npm package to latest version
  console.log(`Updating ${description}...`)
  execSync(`npm install ${packageName}@latest`, {
    stdio: 'inherit'
  })

  // Get the new version from package.json
  const packageLock = JSON.parse(readFileSync('./package-lock.json', 'utf8'))
  const newVersion = packageLock.packages[`node_modules/${packageName}`].version

  // Stage changes
  const message = `[chore] Update electron-types to ${newVersion}`
  execSync('git add package.json package-lock.json', { stdio: 'inherit' })
  execSync(`git commit -m "${message}"`, { stdio: 'inherit' })

  // Create the PR
  console.log('Creating PR...')
  execSync(
    `gh pr create --title "${message}" --label "dependencies" --body "Automated update of ${description} to version ${newVersion}."`,
    { stdio: 'inherit' }
  )

  console.log(
    `✅ Successfully created PR for ${description} update to ${newVersion}`
  )
} catch (error) {
  console.error('❌ Error during update process:', error.message)
}
