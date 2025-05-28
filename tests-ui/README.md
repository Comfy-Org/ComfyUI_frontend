# ComfyUI Frontend Testing Guide

This guide provides an overview of testing approaches used in the ComfyUI Frontend codebase. These guides are meant to document any particularities or nuances of writing tests in this codebase, rather than being a comprehensive guide to testing in general. By reading these guides first, you may save yourself some time when encountering issues.

## Testing Documentation

Documentation for unit tests is organized into three guides:

- [Component Testing](./component-testing.md) - How to test Vue components
- [Unit Testing](./unit-testing.md) - How to test utility functions, composables, and other non-component code
- [Store Testing](./store-testing.md) - How to test Pinia stores specifically

## Testing Structure

The ComfyUI Frontend project uses a mixed approach to unit test organization:

- **Component Tests**: Located directly alongside their components with a `.spec.ts` extension
- **Unit Tests**: Located in the `tests-ui/tests/` directory
- **Store Tests**: Located in the `tests-ui/tests/store/` directory
- **Browser Tests**: These are located in the `browser_tests/` directory. There is a dedicated README in the `browser_tests/` directory, so it will not be covered here.

## Test Frameworks and Libraries

Our tests use the following frameworks and libraries:

- [Vitest](https://vitest.dev/) - Test runner and assertion library
- [@vue/test-utils](https://test-utils.vuejs.org/) - Vue component testing utilities
- [Pinia](https://pinia.vuejs.org/cookbook/testing.html) - For store testing

## Getting Started

To run the tests locally:

```bash
# Run unit tests
npm run test:unit

# Run unit tests in watch mode
npm run test:unit:dev

# Run component tests with browser-native environment
npm run test:component
```

Refer to the specific guides for more detailed information on each testing type.