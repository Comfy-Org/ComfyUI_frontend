import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Set the config path to use vtsls config
process.env.CCLSP_CONFIG_PATH = '/Users/blake/source/ComfyUI_frontend/.claude/cclsp-vtsls.json';

const transport = new StdioClientTransport({
  command: 'cclsp',
  args: [],
  env: {
    ...process.env,
    CCLSP_CONFIG_PATH: '/Users/blake/source/ComfyUI_frontend/.claude/cclsp-vtsls.json',
  },
});

const client = new Client(
  {
    name: 'test-client',
    version: '1.0.0',
  },
  {
    capabilities: {},
  }
);

await client.connect(transport);

console.log('Testing go_to_source_definition with vtsls...\n');

const result = await client.callTool({
  name: 'go_to_source_definition',
  arguments: {
    file_path: './src/App.vue',
    line: 17, // GlobalDialog import
    character: 20,
  },
});

console.log('Result:', JSON.stringify(result, null, 2));
await client.close();
await transport.close();
