# Run performance tests with more detailed output
npx playwright test --workers 1 --project=performance --reporter=line --ignore-snapshots --ui

# Run performance tests on specific files
#npx playwright test --workers 1 --project=performance interaction.spec.ts

# Run performance tests with trace for debugging
#npx playwright test --workers 1 --project=performance --trace=on

# Run performance tests and update any snapshots
#npx playwright test --workers 1 --project=performance --update-snapshots

