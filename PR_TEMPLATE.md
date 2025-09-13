## Summary

Implement execution progress state tracking for Vue nodes with provide/inject pattern and Figma-compliant visual indicators.

## Changes

- **What**: Added execution progress composables, injection keys, visual progress bars with blue borders (#0B8CE9) and header-positioned progress indicators
- **Dependencies**: None

## Review Focus

- Provide/inject pattern implementation vs props approach
- Progress bar positioning at header bottom (56px from top) 
- Reactivity chain: executionStore → provider → consumer composables
- Visual design compliance with Figma specs (#0B8CE9 blue, correct positioning)
- Test coverage for multiple nodes, error states, and edge cases