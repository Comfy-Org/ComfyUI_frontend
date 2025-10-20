# Unit Testing Guidelines

## Running Tests
- Single file: `pnpm test:unit -- <filename>`
- All tests: `pnpm test:unit`
- Wrong Examples:
  - Still runs all tests: `pnpm test:unit <filename>`

## Testing Approach

- Write tests for new features
- Run single tests for performance
- Follow existing test patterns

## Test Structure

- Check @tests-ui/README.md for guidelines
- Use existing test utilities
- Mock external dependencies

## Mocking
- Read: https://vitest.dev/api/mock.html
- Critical: Always prefer vitest mock functions over writing verbose manual mocks
