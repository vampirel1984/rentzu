import React, { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthResponse, verifyCode } from '../services/auth';
import { saveSession, setAccessToken } from '../services/api';

type Props = {
  email: string;
  debugCode?: string;
  deliveryMode?: 'smtp' | 'outbox';
  requestMessage?: string;
  onBack: () => void;
  onVerified: (result: AuthResponse) => void;
  onDebugPayload?: (payload: string) => void;
};

export default function VerifyEmailScreen({ email, debugCode, deliveryMode, requestMessage, onBack, onVerified, onDebugPayload }: Props) {
  const [code, setCode] = useState(debugCode ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const normalizedCode = code.replace(/\D/g, '').trim();

  const handleVerify = async () => {
    setError('');
    const payloadPreview = JSON.stringify({ email, rawCode: code, normalizedCode, rawLength: code.length, normalizedLength: normalizedCode.length });
    onDebugPayload?.(payloadPreview);
    try {
      setLoading(true);
      const result = await verifyCode(email, normalizedCode);
      if (result.access_token) {
        setAccessToken(result.access_token);
        await saveSession({
          userId: result.user_id || '',
          email,
          organizationId: result.organization_id || '',
          organizationIds: result.organization_ids || [],
        });
      }
      onVerified(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>📨</Text>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>We sent a 6-digit verification code to {email}. If this is your first time, verification will also create your account automatically.</Text>

        <Text style={styles.label}>Verification code</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          autoCorrect={false}
          autoComplete="off"
          textContentType="oneTimeCode"
          importantForAutofill="no"
          placeholder="123456"
          placeholderTextColor="#4b5563"
        />

        <Pressable style={styles.primaryButton} onPress={handleVerify}>
          <Text style={styles.primaryButtonText}>{loading ? 'Verifying...' : 'Verify email'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Back to login</Text>
        </Pressable>

        {!!requestMessage && <Text style={styles.helper}>{requestMessage}</Text>}
        {deliveryMode === 'outbox' && !!debugCode && <Text style={styles.helper}>SMTP is not configured. Dev code: {debugCode}</Text>}
        {deliveryMode === 'smtp' && <Text style={styles.helper}>Verification email was sent. Check your inbox for the 6-digit code.</Text>}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a', padding: 20, justifyContent: 'center' },
  card: {
    backgroundColor: 'rgba(17,24,39,0.8)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(55,65,81,0.5)',
  },
  icon: { textAlign: 'center', fontSize: 34, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#f1f5f9', textAlign: 'center' },
  subtitle: { color: '#94a3b8', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10, marginBottom: 18 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 15,
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 8,
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
  helper: { color: '#4b5563', fontSize: 12, textAlign: 'center', marginTop: 14 },
  error: { color: '#ef4444', marginTop: 12, fontSize: 12, textAlign: 'center' },
});
