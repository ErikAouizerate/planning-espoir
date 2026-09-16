import type { Config } from 'jest';

export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(ts|js)$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  // `jose` ships ESM and must be transformed. The pnpm store nests it under
  // node_modules/.pnpm/<pkg>/node_modules/jose, so match both layouts.
  transformIgnorePatterns: ['node_modules/(?!(?:.pnpm/[^/]+/node_modules/)?jose/)'],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
} satisfies Config;
