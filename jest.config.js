module.exports = {
  // Use ts-jest for TypeScript support
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Mock Expo modules that don't work in Node
    '^expo-location$': '<rootDir>/__mocks__/expo-location.js',
    '^expo-haptics$': '<rootDir>/__mocks__/expo-haptics.js',
    '^expo-notifications$': '<rootDir>/__mocks__/expo-notifications.js',
    '^expo-calendar$': '<rootDir>/__mocks__/expo-calendar.js',
    '^expo-constants$': '<rootDir>/__mocks__/expo-constants.js',
    '^react-native-maps$': '<rootDir>/__mocks__/react-native-maps.js',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Test timeout (30 seconds for API calls)
  testTimeout: 30000,

  // Coverage configuration
  collectCoverageFrom: [
    'services/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.{ts,tsx}',
    '**/__tests__/**/*.spec.{ts,tsx}',
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/setup/'],

  // Transform configuration - handle TypeScript
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        jsx: 'react',
      },
    }],
  },

  // Transform ignore patterns - transform these node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(@supabase|expo-.*|@expo|react-native|@react-native)/)',
  ],

  // Clear mocks between tests
  clearMocks: true,

  // Verbose output
  verbose: true,
};
