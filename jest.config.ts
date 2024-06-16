/** @type {import('jest').Config} */
export default {
	preset: "ts-jest",
	testEnvironment: "jsdom",
	transform: {
		"^.+\\.(ts|tsx)$": ["ts-jest", "tsconfig.json"]
	},
	setupFiles: ["./tests-ui/globalSetup.ts"],
	setupFilesAfterEnv: ["./tests-ui/afterSetup.ts"],
	clearMocks: true,
	resetModules: true,
	testTimeout: 10000,
	moduleNameMapper: {
		"^src/(.*)$": "<rootDir>/src/$1",
	},
};
