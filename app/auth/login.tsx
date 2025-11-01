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
  Image,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function LoginScreen() {
  const { signIn, signInWithGoogle, signInWithFacebook, resetPassword, loading } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      Alert.alert('Sign In Failed', error.message);
    } else {
      // Navigation will be handled by auth state change
      router.replace('/(tabs)');
    }
  }

  async function handleGoogleSignIn() {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);

    if (error) {
      Alert.alert('Google Sign In Failed', error.message);
    }
  }

  async function handleFacebookSignIn() {
    setIsLoading(true);
    const { error, facebookToken } = await signInWithFacebook();
    setIsLoading(false);

    if (error) {
      Alert.alert('Facebook Sign In Failed', error.message);
    } else if (facebookToken) {
      Alert.alert(
        'Success!',
        'We\'ve imported your interests from Facebook to personalize your experience.'
      );
      // Navigation will be handled by auth state change
      router.replace('/auth/onboarding');
    }
  }

  function handleForgotPassword() {
    if (!email.trim()) {
      Alert.alert(
        'Email Required',
        'Please enter your email address to reset your password.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Reset Password',
      `Send password reset instructions to ${email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setIsLoading(true);
            const { error } = await resetPassword(email);
            setIsLoading(false);

            if (error) {
              Alert.alert(
                'Error',
                'Failed to send password reset email. Please check your email address and try again.',
                [{ text: 'OK' }]
              );
            } else {
              Alert.alert(
                'Check Your Email',
                `We've sent password reset instructions to ${email}. Please check your inbox and follow the link to reset your password.`,
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ThemedView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/loop-logo6.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <ThemedText style={styles.title}>Welcome to Loop</ThemedText>
          <ThemedText style={styles.subtitle}>
            Sign in to discover activities tailored to your free time
          </ThemedText>

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
              placeholder="Password"
              placeholderTextColor={colors.icon}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
            />

            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={isLoading}
              style={styles.forgotPasswordContainer}
            >
              <ThemedText style={[styles.forgotPasswordText, { color: colors.tint }]}>
                Forgot Password?
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.tint }]}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.icon }]} />
              <ThemedText style={styles.dividerText}>OR</ThemedText>
              <View style={[styles.dividerLine, { backgroundColor: colors.icon }]} />
            </View>

            <TouchableOpacity
              style={[styles.googleButton, { borderColor: colors.icon }]}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
            >
              <ThemedText style={styles.googleButtonText}>Continue with Google</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.facebookButton, { backgroundColor: '#1877F2' }]}
              onPress={handleFacebookSignIn}
              disabled={isLoading}
            >
              <Text style={styles.facebookButtonText}>Continue with Facebook</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <ThemedText style={styles.footerText}>Don't have an account? </ThemedText>
              <Link href="/auth/signup" asChild>
                <TouchableOpacity>
                  <ThemedText style={[styles.footerLink, { color: colors.tint }]}>
                    Sign Up
                  </ThemedText>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 32,
  },
  logo: {
    width: 140,
    height: 140,
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
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: -8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
