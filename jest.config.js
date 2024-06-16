/** @type {import('jest').Config} */
export default {
	testEnvironment: "jsdom",
	setupFiles: ["./tests-ui/globalSetup.js"],
	setupFilesAfterEnv: ["./tests-ui/afterSetup.js"],
	clearMocks: true,
	resetModules: true,
	testTimeout: 10000
};
