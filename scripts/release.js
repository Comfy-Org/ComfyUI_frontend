import { execSync } from 'child_process'
import { readFileSync } from 'fs'

try {
  // Run npm version patch and capture the output
  console.log('Bumping version...')
  execSync('npm version patch', { stdio: 'inherit' })

  // Read the new version from package.json
  const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'))
  const newVersion = packageJson.version

  // Create the PR
  console.log('Creating PR...')
  execSync(
    `gh pr create --title "${newVersion}" --label "Release" --body "Automated version bump to ${newVersion}"`,
    { stdio: 'inherit' }
  )

  console.log(`✅ Successfully created PR for version ${newVersion}`)
} catch (error) {
  console.error('❌ Error during release process:', error.message)
}
