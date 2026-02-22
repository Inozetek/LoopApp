import { ExpoConfig, ConfigContext } from 'expo/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('./package.json') as { version: string };

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'LoopApp',
  slug: 'LoopApp',
  // Version is sourced from package.json so there is a single source of truth.
  // EAS manages versionCode / buildNumber via autoIncrement (eas.json) and
  // appVersionSource: "remote" — do NOT hardcode the version string here.
  version: pkg.version,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'loopapp',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    usesAppleSignIn: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Loop needs your location to show nearby activities and calculate distances.',
      NSLocationAlwaysUsageDescription:
        'Loop needs your location to provide recommendations based on your routine and commute.',
      CADisableMinimumFrameDurationOnPhone: true,
      ITSAppUsesNonExemptEncryption: false,
      // NOTE: NSUserTrackingUsageDescription and SKAdNetworkItems removed —
      // Loop does not use ad tracking. Re-add with expo-tracking-transparency if ads are added.
    },
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    },
    bundleIdentifier: 'com.ncasey92.LoopApp',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
      },
    },
    package: 'com.ncasey92.loopapp',
  },
  web: {
    output: 'static' as const,
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    // Sentry plugin: uploads source maps during EAS builds so stack traces in
    // the Sentry dashboard show original TypeScript source lines.
    // Requires SENTRY_ORG, SENTRY_PROJECT, and SENTRY_AUTH_TOKEN in your
    // build environment (EAS secrets or CI env vars).
    // Remove this entry if you decide not to use Sentry.
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG || '',
        project: process.env.SENTRY_PROJECT || '',
        // authToken is only passed when set to avoid spurious warnings in
        // local dev where SENTRY_AUTH_TOKEN is not configured.
        ...(process.env.SENTRY_AUTH_TOKEN
          ? { authToken: process.env.SENTRY_AUTH_TOKEN }
          : {}),
      },
    ],
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#000000',
        },
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Loop needs your location to show nearby activities and calculate distances.',
      },
    ],
    'expo-font',
    'expo-apple-authentication',
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme:
          'com.googleusercontent.apps.32013726509-5mjj8tod9bpn812ovhv9bj3ru8ggn7rh',
      },
    ],
    '@react-native-community/datetimepicker',
    'expo-web-browser',
    [
      'expo-notifications',
      {
        icon: './assets/images/icon.png',
        color: '#7C3AED',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: '0268111f-c9d2-46ec-99c8-777b1393294b',
    },
  },
});
