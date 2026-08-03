import type { Config } from 'jest';

export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(ts|js)$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  transformIgnorePatterns: ['node_modules/(?!(jose)/)'],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
} satisfies Config;
