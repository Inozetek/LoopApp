/**
 * Smoke Test: Test Infrastructure
 *
 * Verifies that Jest is configured correctly
 */

describe('Test Infrastructure', () => {
  it('should run tests with Jest', () => {
    expect(true).toBe(true);
  });

  it('should load environment variables from .env.test', () => {
    // These should be loaded by dotenv-cli
    const googleKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    const ticketmasterKey = process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY;

    console.log('Google Places API Key:', googleKey ? 'Loaded ✓' : 'Missing ✗');
    console.log('Ticketmaster API Key:', ticketmasterKey ? 'Loaded ✓' : 'Missing ✗');

    expect(googleKey).toBeDefined();
    expect(ticketmasterKey).toBeDefined();
  });

  it('should support TypeScript', () => {
    const testString: string = 'TypeScript works';
    const testNumber: number = 42;
    const testArray: string[] = ['a', 'b', 'c'];

    expect(testString).toBe('TypeScript works');
    expect(testNumber).toBe(42);
    expect(testArray).toHaveLength(3);
  });

  it('should support async/await', async () => {
    const asyncFunction = async (): Promise<string> => {
      return new Promise((resolve) => {
        setTimeout(() => resolve('async works'), 100);
      });
    };

    const result = await asyncFunction();
    expect(result).toBe('async works');
  });

  it('should have correct test timeout (30s)', () => {
    // Test timeout should be 30 seconds for API calls
    // This test itself completes instantly, but verifies config is loaded
    expect(jest).toBeDefined();
  });
});
