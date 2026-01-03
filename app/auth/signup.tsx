import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function SignupScreen() {
  const { signUp, signInWithGoogle, signInWithFacebook, loading } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignUp() {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    const { error, user } = await signUp(email, password);
    setIsLoading(false);

    if (error) {
      Alert.alert('Sign Up Failed', error.message);
    }
    // Navigation to onboarding is handled automatically by _layout.tsx
    // based on auth state (session exists but no user profile)
  }

  async function handleGoogleSignUp() {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);

    if (error) {
      Alert.alert('Google Sign Up Failed', error.message);
    }
  }

  async function handleFacebookSignUp() {
    setIsLoading(true);
    const { error, facebookToken } = await signInWithFacebook();
    setIsLoading(false);

    if (error) {
      Alert.alert('Facebook Sign Up Failed', error.message);
    } else if (facebookToken) {
      Alert.alert(
        'Success!',
        'We\'ve imported your interests from Facebook to personalize your experience.'
      );
      // Navigation will be handled by auth state change
      router.replace('/auth/onboarding');
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedView style={styles.container}>
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/loop-logo6.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <ThemedText style={styles.subtitle}>
                Join Loop and never miss out on great experiences
              </ThemedText>
            </View>

            <View style={styles.form}>
              <TextInput
                style={[styles.input, { borderColor: colors.icon, color: colors.text }]}
                placeholder="Email"
                placeholderTextColor={colors.icon}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isLoading}
              />

              <TextInput
                style={[styles.input, { borderColor: colors.icon, color: colors.text }]}
                placeholder="Password (min 6 characters)"
                placeholderTextColor={colors.icon}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!isLoading}
              />

              <TextInput
                style={[styles.input, { borderColor: colors.icon, color: colors.text }]}
                placeholder="Confirm Password"
                placeholderTextColor={colors.icon}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!isLoading}
              />

              <TextInput
                style={[styles.input, { borderColor: colors.icon, color: colors.text }]}
                placeholder="Referral Code (Optional)"
                placeholderTextColor={colors.icon}
                value={referralCode}
                onChangeText={(text) => setReferralCode(text.toUpperCase())}
                autoCapitalize="characters"
                maxLength={10}
                editable={!isLoading}
              />

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.tint }]}
                onPress={handleSignUp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Create Account</Text>
                )}
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: colors.icon }]} />
                <ThemedText style={styles.dividerText}>OR</ThemedText>
                <View style={[styles.dividerLine, { backgroundColor: colors.icon }]} />
              </View>

              <TouchableOpacity
                style={[styles.googleButton, { borderColor: colors.icon }]}
                onPress={handleGoogleSignUp}
                disabled={isLoading}
              >
                <ThemedText style={styles.googleButtonText}>Continue with Google</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.facebookButton, { backgroundColor: '#1877F2' }]}
                onPress={handleFacebookSignUp}
                disabled={isLoading}
              >
                <Text style={styles.facebookButtonText}>Continue with Facebook</Text>
              </TouchableOpacity>

              <ThemedText style={styles.terms}>
                By signing up, you agree to our Terms of Service and Privacy Policy
              </ThemedText>

              <View style={styles.footer}>
                <ThemedText style={styles.footerText}>Already have an account? </ThemedText>
                <Link href="/auth/login" asChild>
                  <TouchableOpacity>
                    <ThemedText style={[styles.footerLink, { color: colors.tint }]}>
                      Sign In
                    </ThemedText>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </View>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.7,
  },
  form: {
    gap: 16,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  button: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    opacity: 0.5,
  },
  googleButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  facebookButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  facebookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  terms: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
