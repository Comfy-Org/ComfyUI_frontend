import zipdir from 'zip-dir'

const sourceDir = process.argv[2] || './dist'
const outputPath = process.argv[3] || './dist.zip'

try {
  await zipdir(sourceDir, { saveTo: outputPath })
  process.stdout.write(
    `Successfully zipped "${sourceDir}" directory to "${outputPath}".\n`
  )
} catch (err) {
  console.error(`Error zipping "${sourceDir}" directory:`, err)
  process.exitCode = 1
}
