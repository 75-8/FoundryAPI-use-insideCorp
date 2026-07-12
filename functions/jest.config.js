/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(\\.\\.?\\/.+)\\.js$': '$1',
  },
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/functions/**/*.ts',
    '!src/**/*.test.ts',
  ],
};

module.exports = config;
