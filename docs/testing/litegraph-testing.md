# LiteGraph Testing Guide

This guide covers test patterns for LiteGraph graph, node, link, subgraph, and workflow behavior in ComfyUI Frontend.

## Shared Factories

Reuse shared factories in `src/utils/__tests__/litegraphTestUtils.ts` instead of hand-rolling LiteGraph node, canvas, graph, subgraph, or workflow builders.

Use real LiteGraph instances or shared factories when they exercise behavior directly. Avoid mocking LiteGraph classes unless the test is intentionally checking a seam outside LiteGraph itself.
