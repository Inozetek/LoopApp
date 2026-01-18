// Test Setup File
// Environment variables are loaded via dotenv-cli in package.json test scripts

// Extend Jest timeout globally (30 seconds for API calls)
jest.setTimeout(30000);

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Silence console warnings/errors in tests (optional - uncomment if needed)
// global.console = {
//   ...console,
//   warn: jest.fn(),
//   error: jest.fn(),
// };
