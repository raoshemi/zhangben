module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss)$': '<rootDir>/src/test/styleMock.cjs',
  },
  testMatch: ['**/*.test.(ts|tsx)'],
};
