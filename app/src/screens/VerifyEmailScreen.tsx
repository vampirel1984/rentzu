// Modified by AI on 07/03/2026. Edit #1.
import React, { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthResponse, verifyCode } from '../services/auth';
import { saveSession, setAccessToken } from '../services/api';
import { colors } from '../theme/tokens';

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
          placeholderTextColor={colors.textFaint}
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
  container: { flex: 1, backgroundColor: colors.background, padding: 20, justifyContent: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  icon: { textAlign: 'center', fontSize: 34, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10, marginBottom: 18 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 15,
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 8,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButton: {
    marginTop: 18,
    backgroundColor: colors.accent,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.onAccent, fontWeight: '800', fontSize: 15 },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  secondaryButtonText: { color: colors.textSecondary, fontWeight: '800', fontSize: 14 },
  helper: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 14 },
  error: { color: colors.expense, marginTop: 12, fontSize: 12, textAlign: 'center' },
});
