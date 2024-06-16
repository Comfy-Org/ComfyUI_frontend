/** @type {import('jest').Config} */
export default {
	preset: "ts-jest",
	testEnvironment: "jsdom",
	globals: {
		"ts-jest": {
			tsconfig: "tsconfig.json"
		}
	},
	transform: {
		"^.+\\.(ts|tsx)$": "ts-jest"
	},
	setupFiles: ["./tests-ui/globalSetup.js"],
	setupFilesAfterEnv: ["./tests-ui/afterSetup.js"],
	clearMocks: true,
	resetModules: true,
	testTimeout: 10000
};
