import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
	testEnvironment: "jsdom",
	transform: {
		'^.+\\.m?[tj]sx?$': ["ts-jest", {
			tsconfig: "./tsconfig.json",
			babelConfig: "./babel.config.json",
		}],
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

export default jestConfig;