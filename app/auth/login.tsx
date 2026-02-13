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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/auth-context';
import { LoopLogoVariant } from '@/components/loop-logo-variant';

// Always-dark theme
const theme = {
  bg: '#000000',
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.50)',
  textSubtle: 'rgba(255,255,255,0.25)',
  border: 'rgba(255,255,255,0.12)',
  borderSubtle: 'rgba(255,255,255,0.06)',
  accent: '#10a37f',
};

export default function LoginScreen() {
  const {
    signIn,
    signInWithGoogle,
    signInWithApple,
    signInWithFacebook,
    resetPassword,
    loading,
    isAppleSignInAvailable,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

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
    }
  }

  async function handleGoogleSignIn() {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);
    if (error && !error.message.includes('cancelled')) {
      Alert.alert('Google Sign In Failed', error.message);
    }
  }

  async function handleFacebookSignIn() {
    setIsLoading(true);
    const { error } = await signInWithFacebook();
    setIsLoading(false);
    if (error && !error.message.includes('cancelled')) {
      Alert.alert('Facebook Sign In Failed', error.message);
    }
  }

  async function handleAppleSignIn() {
    setIsLoading(true);
    const { error } = await signInWithApple();
    setIsLoading(false);
    if (error && !error.message.includes('cancelled')) {
      Alert.alert('Apple Sign In Failed', error.message);
    }
  }

  function handleForgotPassword() {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address to reset your password.');
      return;
    }
    Alert.alert('Reset Password', `Send password reset instructions to ${email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          setIsLoading(true);
          const { error } = await resetPassword(email);
          setIsLoading(false);
          if (error) {
            Alert.alert('Error', 'Failed to send password reset email.');
          } else {
            Alert.alert('Check Your Email', `We've sent password reset instructions to ${email}.`);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="small" color={theme.text} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              {/* Logo */}
              <View style={styles.header}>
                <LoopLogoVariant size={36} />
              </View>

              {/* Welcome text */}
              <Text style={[styles.welcomeText, { color: theme.text }]}>
                welcome back
              </Text>

              {/* Auth Buttons - Ghost style */}
              <View style={styles.authButtons}>
                {/* Google */}
                <TouchableOpacity
                  style={[styles.ghostButton, { borderColor: theme.border }]}
                  onPress={handleGoogleSignIn}
                  disabled={isLoading}
                  activeOpacity={0.6}
                >
                  <View style={styles.buttonInner}>
                    <View style={[styles.iconCircle, { backgroundColor: '#4285F4' }]}>
                      <Text style={styles.iconText}>G</Text>
                    </View>
                    <Text style={[styles.buttonText, { color: theme.text }]}>
                      continue with google
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Facebook */}
                <TouchableOpacity
                  style={[styles.ghostButton, { borderColor: theme.border }]}
                  onPress={handleFacebookSignIn}
                  disabled={isLoading}
                  activeOpacity={0.6}
                >
                  <View style={styles.buttonInner}>
                    <View style={[styles.iconCircle, { backgroundColor: '#1877F2' }]}>
                      <Ionicons name="logo-facebook" size={14} color="#fff" />
                    </View>
                    <Text style={[styles.buttonText, { color: theme.text }]}>
                      continue with facebook
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Apple */}
                {Platform.OS === 'ios' && isAppleSignInAvailable && (
                  <TouchableOpacity
                    style={[styles.ghostButton, { borderColor: theme.border }]}
                    onPress={handleAppleSignIn}
                    disabled={isLoading}
                    activeOpacity={0.6}
                  >
                    <View style={styles.buttonInner}>
                      <View style={[styles.iconCircle, { backgroundColor: '#ffffff' }]}>
                        <Ionicons name="logo-apple" size={14} color="#000000" />
                      </View>
                      <Text style={[styles.buttonText, { color: theme.text }]}>
                        continue with apple
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: theme.borderSubtle }]} />
                <TouchableOpacity
                  onPress={() => setShowEmailForm(!showEmailForm)}
                  hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}
                >
                  <Text style={[styles.dividerText, { color: theme.textSubtle }]}>
                    {showEmailForm ? 'hide' : 'or'}
                  </Text>
                </TouchableOpacity>
                <View style={[styles.dividerLine, { backgroundColor: theme.borderSubtle }]} />
              </View>

              {/* Email Form */}
              {showEmailForm ? (
                <View style={styles.emailForm}>
                  <TextInput
                    style={[styles.input, { borderBottomColor: theme.border, color: theme.text }]}
                    placeholder="email"
                    placeholderTextColor={theme.textSubtle}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!isLoading}
                  />
                  <TextInput
                    style={[styles.input, { borderBottomColor: theme.border, color: theme.text }]}
                    placeholder="password"
                    placeholderTextColor={theme.textSubtle}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    onPress={handleForgotPassword}
                    disabled={isLoading}
                    style={styles.forgotLink}
                  >
                    <Text style={[styles.forgotText, { color: theme.accent }]}>
                      forgot password?
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: theme.accent }]}
                    onPress={handleSignIn}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>continue</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.ghostButton, { borderColor: theme.border }]}
                  onPress={() => setShowEmailForm(true)}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.buttonText, { color: theme.text }]}>
                    continue with email
                  </Text>
                </TouchableOpacity>
              )}

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={[styles.footerText, { color: theme.textMuted }]}>
                  don&apos;t have an account?{' '}
                </Text>
                <Link href="/auth/signup" asChild>
                  <TouchableOpacity>
                    <Text style={[styles.footerLink, { color: theme.accent }]}>sign up</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>

            {/* Terms - Bottom */}
            <Text style={[styles.terms, { color: theme.textSubtle }]}>
              by continuing, you agree to our terms and privacy policy
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    maxWidth: 360,
    width: '100%',
    alignSelf: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },

  // Welcome
  welcomeText: {
    fontSize: 24,
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 32,
  },

  // Auth Buttons
  authButtons: {
    gap: 12,
  },
  ghostButton: {
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '400',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 13,
    fontWeight: '300',
  },

  // Email Form
  emailForm: {
    gap: 16,
  },
  input: {
    height: 48,
    borderBottomWidth: 1,
    paddingHorizontal: 0,
    fontSize: 16,
    fontWeight: '300',
    backgroundColor: 'transparent',
  },
  forgotLink: {
    alignSelf: 'flex-start',
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '400',
  },
  primaryButton: {
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '300',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Terms
  terms: {
    fontSize: 12,
    fontWeight: '300',
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    lineHeight: 18,
  },
});
