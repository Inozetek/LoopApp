/**
 * Environment Variable Validator
 *
 * Validates required environment variables on app startup.
 * Provides clear error messages and warnings for missing/invalid config.
 */

interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface EnvVar {
  key: string;
  required: boolean;
  description: string;
  validator?: (value: string | undefined) => boolean;
}

/**
 * Define all environment variables and their requirements
 */
const ENV_VARS: EnvVar[] = [
  // REQUIRED
  {
    key: 'EXPO_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
    validator: (value) => !!value && value.includes('supabase.co'),
  },
  {
    key: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous key',
    validator: (value) => !!value && value.length > 100,
  },

  // OPTIONAL BUT RECOMMENDED
  {
    key: 'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY',
    required: true,
    description: 'Google Places API key (REQUIRED for production - app will not function without it)',
  },
  {
    key: 'SENTRY_DSN',
    required: false,
    description: 'Sentry DSN for error tracking',
  },
  {
    key: 'EXPO_PUBLIC_POSTHOG_API_KEY',
    required: false,
    description: 'PostHog API key for analytics',
  },
];

/**
 * Validate all environment variables
 */
export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check each environment variable
  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.key];

    // Check if required variable is missing
    if (envVar.required && !value) {
      errors.push(`❌ Missing required environment variable: ${envVar.key}`);
      errors.push(`   Description: ${envVar.description}`);
      errors.push(`   Fix: Add ${envVar.key} to your .env file`);
      continue;
    }

    // Run custom validator if provided
    if (value && envVar.validator && !envVar.validator(value)) {
      errors.push(`❌ Invalid value for ${envVar.key}`);
      errors.push(`   Description: ${envVar.description}`);
      errors.push(`   Current value appears to be incorrect or malformed`);
      continue;
    }

    // Warn about missing optional but recommended variables
    if (!envVar.required && !value) {
      warnings.push(`⚠️  Optional environment variable not set: ${envVar.key}`);
      warnings.push(`   Description: ${envVar.description}`);
    }
  }

  // Check for placeholder values
  const placeholderPatterns = [
    'your_',
    'your-',
    'placeholder',
    'example',
    'test_key',
  ];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.key];
    if (value) {
      for (const pattern of placeholderPatterns) {
        if (value.toLowerCase().includes(pattern)) {
          if (envVar.required) {
            errors.push(`❌ ${envVar.key} contains placeholder value`);
            errors.push(`   Current value: ${value.substring(0, 30)}...`);
            errors.push(`   Fix: Replace with your actual ${envVar.description}`);
          } else {
            warnings.push(`⚠️  ${envVar.key} may contain placeholder value`);
          }
          break;
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log validation results to console
 */
export function logValidationResults(result: EnvValidationResult): void {
  if (!result.isValid) {
    console.error('\n🚨 ENVIRONMENT VALIDATION FAILED 🚨\n');
    result.errors.forEach(error => console.error(error));
    console.error('\n📝 See .env.example for required variables\n');
  }

  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Environment Warnings:\n');
    result.warnings.forEach(warning => console.warn(warning));
    console.warn('');
  }

  if (result.isValid && result.warnings.length === 0) {
    console.log('✅ Environment validation passed - all required variables set');
  }
}

/**
 * Get a specific environment variable with fallback
 */
export function getEnvVar(
  key: string,
  fallback?: string,
  required: boolean = false
): string | undefined {
  const value = process.env[key];

  if (!value) {
    if (required) {
      throw new Error(
        `Missing required environment variable: ${key}. Check your .env file.`
      );
    }
    return fallback;
  }

  return value;
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || __DEV__;
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' && !__DEV__;
}

/**
 * Check if debug mode is enabled
 */
export function isDebugMode(): boolean {
  return process.env.EXPO_PUBLIC_DEBUG_MODE === 'true';
}

/**
 * Check if mock mode is enabled (bypasses external APIs)
 */
export function isMockMode(): boolean {
  return process.env.EXPO_PUBLIC_MOCK_MODE === 'true';
}

/**
 * Get display name for environment
 */
export function getEnvironmentName(): string {
  if (isMockMode()) return 'Mock';
  if (isProduction()) return 'Production';
  if (isDevelopment()) return 'Development';
  return 'Unknown';
}

/**
 * Print environment info (useful for debugging)
 */
export function printEnvironmentInfo(): void {
  console.log('\n📦 Loop App Environment:');
  console.log(`   Mode: ${getEnvironmentName()}`);
  console.log(`   Debug: ${isDebugMode() ? 'Enabled' : 'Disabled'}`);
  console.log(
    `   Google Places API: ${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ? 'Configured ✅' : 'NOT CONFIGURED ❌ (REQUIRED FOR APP TO FUNCTION)'}`
  );
  console.log(
    `   Sentry: ${process.env.SENTRY_DSN ? 'Enabled' : 'Disabled'}`
  );
  console.log(
    `   Analytics: ${process.env.EXPO_PUBLIC_POSTHOG_API_KEY || process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ? 'Enabled' : 'Disabled'}`
  );
  console.log('');
}
