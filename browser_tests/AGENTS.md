# E2E Testing Guidelines

## Best Practices

- Test user workflows with Playwright fixtures
- Check `assets/` for test data
- Prefer specific selectors
- Test across viewports

## Testing Process

After code changes:
1. Create browser tests as appropriate
2. Run tests until passing
3. Then run typecheck, lint, format
