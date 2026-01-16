module.exports = {
    // Use node environment for simpler module resolution
    testEnvironment: 'node',
    setupFilesAfterEnv: ['./jest.setup.js'],
    testMatch: [
        '**/__tests__/integration/**/*.test.ts',
        '**/__tests__/integration/**/*.test.tsx',
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest'],
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },
    // Exclude node_modules except specific packages
    transformIgnorePatterns: [
        'node_modules/(?!(nanoid)/)',
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/__tests__/*.pbt.ts', // Exclude Property-Based Tests
    ],
    // Ignore haste collisions from other projects
    modulePathIgnorePatterns: [
        '<rootDir>/continuous-claude/',
    ],
};
