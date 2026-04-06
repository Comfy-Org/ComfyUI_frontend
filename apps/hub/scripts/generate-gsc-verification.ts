import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

/**
 * Generates a Google Search Console HTML verification file.
 *
 * Usage:
 *   pnpm tsx scripts/generate-gsc-verification.ts <verification-code>
 *
 * Example:
 *   pnpm tsx scripts/generate-gsc-verification.ts google1234567890abcdef
 *
 * This will create: public/google1234567890abcdef.html
 */

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error(
      'Usage: pnpm tsx scripts/generate-gsc-verification.ts <verification-code>'
    )
    console.error('')
    console.error('Example:')
    console.error(
      '  pnpm tsx scripts/generate-gsc-verification.ts google1234567890abcdef'
    )
    console.error('')
    console.error(
      'The verification code is provided by Google Search Console when you'
    )
    console.error('choose the "HTML file" verification method.')
    process.exit(1)
  }

  const verificationCode = args[0]

  if (!verificationCode.startsWith('google')) {
    console.warn(
      'Warning: Google verification codes typically start with "google"'
    )
    console.warn(`You provided: ${verificationCode}`)
    console.warn('Continuing anyway...')
  }

  const publicDir = path.join(process.cwd(), 'public')
  if (!existsSync(publicDir)) {
    await mkdir(publicDir, { recursive: true })
  }

  const filename = verificationCode.endsWith('.html')
    ? verificationCode
    : `${verificationCode}.html`

  const filepath = path.join(publicDir, filename)

  const content = `google-site-verification: ${filename}`

  await writeFile(filepath, content, 'utf-8')

  console.log(`✓ Created verification file: public/${filename}`)
  console.log('')
  console.log('Next steps:')
  console.log('1. Commit and deploy the site')
  console.log(
    `2. Verify the file is accessible at: https://comfy.org/${filename}`
  )
  console.log('3. Click "Verify" in Google Search Console')
}

main().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
