import { createStorybookMcpHandler } from '@storybook/mcp'

const handleMcpRequest = await createStorybookMcpHandler()

export const GET = handleMcpRequest
export const POST = handleMcpRequest
export const DELETE = handleMcpRequest
