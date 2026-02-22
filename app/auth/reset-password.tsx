import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LoopLogoVariant } from '@/components/loop-logo-variant';

const theme = {
  bg: '#000000',
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.50)',
  textSubtle: 'rgba(255,255,255,0.25)',
  border: 'rgba(255,255,255,0.12)',
  accent: '#10a37f',
};

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // The deep link will have set the session via Supabase auth listener
    // Check if we have a valid session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
      } else {
        // Listen for auth state change (token from deep link)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
          if (event === 'PASSWORD_RECOVERY' && session) {
            setSessionReady(true);
          }
        });
        return () => subscription.unsubscribe();
      }
    };
    checkSession();
  }, []);

  async function handleResetPassword() {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in both fields');
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
    try {
      const { error } = await supabase.auth.updateUser({ password });
      setIsLoading(false);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert(
          'Password Updated',
          'Your password has been successfully updated.',
          [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
        );
      }
    } catch (error) {
      setIsLoading(false);
      Alert.alert('Error', 'Failed to update password. Please try again.');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.header}>
            <LoopLogoVariant size={36} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>
            reset your password
          </Text>

          {!sessionReady ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color={theme.text} />
              <Text style={[styles.loadingText, { color: theme.textMuted }]}>
                Verifying reset link...
              </Text>
            </View>
          ) : (
            <View style={styles.form}>
              <TextInput
                style={[styles.input, { borderBottomColor: theme.border, color: theme.text }]}
                placeholder="new password (min 6 characters)"
                placeholderTextColor={theme.textSubtle}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                maxLength={128}
                editable={!isLoading}
              />
              <TextInput
                style={[styles.input, { borderBottomColor: theme.border, color: theme.text }]}
                placeholder="confirm new password"
                placeholderTextColor={theme.textSubtle}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                maxLength={128}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.accent }]}
                onPress={handleResetPassword}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>update password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.replace('/auth/login')}
          >
            <Text style={[styles.backLinkText, { color: theme.accent }]}>
              back to sign in
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    maxWidth: 360,
    width: '100%',
    alignSelf: 'center',
  },
  header: { alignItems: 'center', marginBottom: 48 },
  title: {
    fontSize: 24,
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 32,
  },
  form: { gap: 16 },
  input: {
    height: 48,
    borderBottomWidth: 1,
    paddingHorizontal: 0,
    fontSize: 16,
    fontWeight: '300',
    backgroundColor: 'transparent',
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
  loadingState: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '300',
  },
  backLink: {
    alignItems: 'center',
    marginTop: 32,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
