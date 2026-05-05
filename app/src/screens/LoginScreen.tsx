import React, { useState } from 'react';
import { Image, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthResponse, createDevSession, requestCode } from '../services/auth';
import { saveSession, setAccessToken } from '../services/api';

const logoImage = require('../../assets/logo_1.png');

type Props = {
  onSuccess: (result: AuthResponse & { email: string }) => void;
};

export default function LoginScreen({ onSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email.includes('@') || !password) {
      setError('Please enter a valid email and password.');
      return;
    }
    try {
      setLoading(true);
      const result = await requestCode(email, password);
      if (result.access_token) {
        setAccessToken(result.access_token);
      }
      onSuccess({ ...result, email });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleDevContinue = async () => {
    setError('');
    if (!email.includes('@') || !password) {
      setError('Please enter a valid email and password.');
      return;
    }
    try {
      setLoading(true);
      const result = await createDevSession(email, password);
      if (result.access_token) {
        setAccessToken(result.access_token);
        await saveSession({
          userId: result.user_id || '',
          email,
          organizationId: result.organization_id || '',
          organizationIds: result.organization_ids || [],
        });
      }
      onSuccess({ ...result, email });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create local dev session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoWrap}>
        <Image source={logoImage} style={styles.logo} resizeMode="contain" />
        <View style={styles.pill}><Text style={styles.pillText}>Voice-first</Text></View>
      </View>

      <Text style={styles.eyebrow}>Property management for landlords</Text>
      <Text style={styles.title}>Hands-free property management</Text>
      <Text style={styles.subtitle}>Voice capture, bookkeeping replacement, and tax-ready records in one landlord app.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Create account or sign in</Text>
        <Text style={styles.cardTitle}>Get into your portfolio</Text>

        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#4b5563"
        />

        <Text style={styles.fieldLabel}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          placeholder="Create or enter your password"
          placeholderTextColor="#4b5563"
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          blurOnSubmit
        />

        <Pressable style={[styles.primaryButton, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? 'Sending code...' : 'Continue with email'}</Text>
        </Pressable>

        <Pressable style={[styles.secondaryButton, loading && styles.buttonDisabled]} onPress={handleDevContinue} disabled={loading}>
          <Text style={styles.secondaryButtonText}>{loading ? 'Preparing workspace...' : 'Enter local dev workspace'}</Text>
        </Pressable>

        {!!error && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.helper}>New users are created automatically on first continue. Rentzu will try to send a verification email right away.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a', padding: 20 },
  logoWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  logo: {
    width: 140,
    height: 42,
  },
  pill: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  pillText: { color: '#3b82f6', fontWeight: '800', fontSize: 12 },
  eyebrow: { color: '#64748b', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '900', color: '#f1f5f9', lineHeight: 34 },
  subtitle: { color: '#94a3b8', fontSize: 14, lineHeight: 21, marginTop: 10 },
  card: {
    backgroundColor: 'rgba(17,24,39,0.8)',
    borderRadius: 24,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(55,65,81,0.5)',
  },
  label: { color: '#64748b', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#f1f5f9', marginBottom: 14 },
  fieldLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 10 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 15,
    fontSize: 14,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  primaryButton: {
    marginTop: 18,
    backgroundColor: '#3b82f6',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  secondaryButtonText: { color: '#94a3b8', fontWeight: '800', fontSize: 14 },
  buttonDisabled: { opacity: 0.6 },
  helper: { color: '#4b5563', marginTop: 14, fontSize: 12, lineHeight: 18 },
  error: { color: '#ef4444', marginTop: 12, fontSize: 12 },
});
