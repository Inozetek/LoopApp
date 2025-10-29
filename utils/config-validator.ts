/**
 * Configuration Validator
 *
 * Validates that all required environment variables are set
 * and provides helpful error messages if they're missing.
 */

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required variables
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  // Check required Supabase config
  if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
    errors.push(
      'EXPO_PUBLIC_SUPABASE_URL is not set.\n' +
      'Get it from: https://supabase.com/dashboard/project/_/settings/api'
    );
  }

  if (!supabaseAnonKey || supabaseAnonKey === 'your_anon_key_here') {
    errors.push(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY is not set.\n' +
      'Get it from: https://supabase.com/dashboard/project/_/settings/api'
    );
  }

  // Optional but recommended variables
  const googlePlacesKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!googlePlacesKey || googlePlacesKey === 'your_key_here') {
    warnings.push(
      'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is not set.\n' +
      'The app will use mock data for activity recommendations.\n' +
      'Get a real API key at: https://console.cloud.google.com/apis/credentials'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function logValidationResults(result: ValidationResult): void {
  if (!result.isValid) {
    console.error('❌ Configuration Error:');
    result.errors.forEach((error, i) => {
      console.error(`\n${i + 1}. ${error}`);
    });
    console.error('\n💡 Copy .env.example to .env and fill in your values.');
  } else {
    console.log('✅ Configuration is valid');
  }

  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Configuration Warnings:');
    result.warnings.forEach((warning, i) => {
      console.warn(`\n${i + 1}. ${warning}`);
    });
  }
}

export function getConfigSummary(): {
  supabase: { url: string; configured: boolean };
  googlePlaces: { configured: boolean };
  environment: string;
} {
  return {
    supabase: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'NOT SET',
      configured: Boolean(
        process.env.EXPO_PUBLIC_SUPABASE_URL &&
        process.env.EXPO_PUBLIC_SUPABASE_URL !== 'https://your-project.supabase.co' &&
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY !== 'your_anon_key_here'
      ),
    },
    googlePlaces: {
      configured: Boolean(
        process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY &&
        process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY !== 'your_key_here'
      ),
    },
    environment: process.env.NODE_ENV || 'development',
  };
}
