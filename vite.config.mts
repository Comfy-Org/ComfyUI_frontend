import { defineConfig } from 'vite';
import noBundlePlugin from 'vite-plugin-no-bundle';


export default defineConfig({
	server: {
		open: true,
		proxy: {
			// Proxy websocket requests to the server
			'/': {
				target: 'ws://127.0.0.1:8188',
				ws: true,
			}
		}
	},
	plugins: [noBundlePlugin({ copy: ['**/*.css', 'lib/*.js'] })],
	build: {
		lib: {
			formats: ['es'],
			entry: 'index.html',
		},
		minify: false,
	},
});