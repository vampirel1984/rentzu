// Modified by AI on 07/03/2026. Edit #1.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { Organization, updateOrganization } from '../services/organizations';
import { getPortfolioSummary, listProperties, Property, PropertyPortfolioSummary } from '../services/properties';
import { colors } from '../theme/tokens';

const heroImage = require('../../assets/logo_2.png');
const logoImage = require('../../assets/logo_1.png');
const bellIcon = require('../../assets/logo_8.png');
const houseIcon = require('../../assets/logo_6.png');
const buildingIcon = require('../../assets/logo_5.png');
const micIcon = require('../../assets/logo_7.png');

const formatPropertyType = (value?: string): string => {
  if (!value) return 'Property';
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};

type Props = {
  organizationId?: string;
  userId?: string;
  email?: string;
  organization?: Organization;
  organizations?: Organization[];
  selectedPropertyId?: string;
  refreshKey?: number;
  onSelectProperty: (propertyId: string) => void;
  onSelectOrganization?: (orgId: string) => void;
  onOpenPropertyTab: () => void;
  onOpenNewProperty: () => void;
  onEditProperty: (property: Property) => void;
  onQuickAddRecord?: (property: Property) => void;
  onOrganizationUpdated?: (organization: Organization) => void;
};

export default function SummaryScreen({
  organizationId, userId, email, organization, organizations,
  selectedPropertyId, refreshKey,
  onSelectProperty, onSelectOrganization, onOpenPropertyTab, onOpenNewProperty,
  onEditProperty, onQuickAddRecord, onOrganizationUpdated,
}: Props) {
  const [portfolioSummary, setPortfolioSummary] = useState<PropertyPortfolioSummary | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  const refreshData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [summary, propertyRows] = await Promise.all([
        getPortfolioSummary(organizationId, currentYear),
        listProperties(organizationId),
      ]);
      setPortfolioSummary(summary);
      setProperties(propertyRows);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load summary data.');
    } finally {
      setLoading(false);
    }
  }, [currentYear, organizationId]);

  useEffect(() => { refreshData(); }, [refreshData, refreshKey]);

  const { recording, recordingPropertyId, transcribing, voiceError, handleVoicePress } = useVoiceRecorder({
    organizationId,
    userId,
    onInserted: async (_propertyId, count, propertyName) => {
      Alert.alert('Records added', `${count} record(s) added to ${propertyName || 'property'} via voice.`);
      await refreshData();
    },
    onFallback: (propertyId) => {
      const prop = properties.find(p => p.id === propertyId);
      if (prop) onQuickAddRecord?.(prop);
    },
  });

  const formatMoney = (value?: string | number | null) => {
    const amount = Number(value || 0);
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };


  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const userName = email ? email.split('@')[0].split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') : 'User';

  const getPropertyIcon = (type?: string) => {
    if (!type) return houseIcon;
    const t = type.toLowerCase();
    if (t.includes('single') || t.includes('house') || t.includes('sfr')) return houseIcon;
    return buildingIcon;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Header with logo_2 background */}
        <ImageBackground source={heroImage} style={styles.heroBackground} imageStyle={styles.heroImage}>
          <View style={styles.headerRow}>
            <Image source={logoImage} style={styles.brandLogo} resizeMode="contain" />
            <Pressable style={styles.bellButton}>
              <Image source={bellIcon} style={styles.bellIcon} resizeMode="contain" />
            </Pressable>
          </View>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.userName}>{userName} 👋</Text>
        </ImageBackground>

        {/* Organization Dropdown */}
        <Pressable style={styles.orgDropdown} onPress={() => setOrgDropdownOpen(!orgDropdownOpen)}>
          <Text style={styles.orgDropdownIcon}>🏢</Text>
          <Text style={styles.orgDropdownText}>{organization?.name || 'All Organizations'}</Text>
          <Text style={styles.orgDropdownCaret}>▾</Text>
        </Pressable>
        {orgDropdownOpen && organizations && organizations.length > 0 && (
          <View style={styles.orgDropdownMenu}>
            {organizations.map((org) => (
              <Pressable key={org.id} style={[styles.orgDropdownItem, org.id === organizationId && styles.orgDropdownItemActive]}
                onPress={() => { onSelectOrganization?.(org.id); setOrgDropdownOpen(false); }}>
                <Text style={[styles.orgDropdownItemText, org.id === organizationId && styles.orgDropdownItemTextActive]}>{org.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        {/* Net Year-to-Date Card */}
        <View style={styles.netCard}>
          <View style={styles.netCardHeader}>
            <Text style={styles.netLabel}>Net year-to-date</Text>
          </View>
          <Text style={[styles.netValue, { color: Number(portfolioSummary?.net_total || 0) >= 0 ? colors.income : colors.textPrimary }]}>
            {formatMoney(portfolioSummary?.net_total)}
          </Text>
          <Text style={styles.netSub}>Across {portfolioSummary?.property_count || 0} properties</Text>
          <View style={styles.incExpRow}>
            <View style={styles.incExpBox}>
              <Text style={styles.incExpLabel}>Income</Text>
              <Text style={styles.incomeValue}>{formatMoney(portfolioSummary?.income_total)}</Text>
            </View>
            <View style={styles.incExpBox}>
              <Text style={styles.incExpLabel}>Expenses</Text>
              <Text style={styles.expenseValue}>{formatMoney(portfolioSummary?.expense_total)}</Text>
            </View>
          </View>
        </View>

        {loading && <ActivityIndicator style={{ marginTop: 12 }} color={colors.accent} />}

        {/* Properties */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Properties</Text>
            <Pressable onPress={onOpenNewProperty}>
              <Text style={styles.seeAllText}>See all</Text>
            </Pressable>
          </View>
          {properties.length === 0 && <Text style={styles.helper}>No properties yet. Add your first one!</Text>}
          {properties.map((property) => (
            <Pressable
              key={property.id}
              style={styles.propertyCard}
              onPress={() => { onSelectProperty(property.id); onOpenPropertyTab(); }}
            >
              <Image source={getPropertyIcon(property.property_type)} style={styles.propertyImage} resizeMode="cover" />
              <View style={styles.propertyInfo}>
                <Text style={styles.propertyName}>{property.name}</Text>
                <Text style={styles.propertyMeta}>
                  {formatPropertyType(property.property_type)} · {property.total_units} {property.total_units === 1 ? 'unit' : 'units'}
                </Text>
              </View>
              <View style={styles.propertyActions}>
                <View style={styles.recordCountBadge}>
                  <Text style={styles.recordCountText}>{portfolioSummary?.properties?.find(p => p.property_id === property.id)?.record_count || 0} records</Text>
                </View>
                <Pressable
                  style={[styles.micButton, recordingPropertyId === property.id && styles.micButtonRecording]}
                  onPress={() => handleVoicePress(property.id, property.name)}
                  disabled={transcribing && recordingPropertyId !== property.id}
                >
                  {transcribing && recordingPropertyId === property.id ? (
                    <ActivityIndicator size="small" color={colors.onAccent} />
                  ) : (
                    <Image source={micIcon} style={[styles.micButtonIcon, recordingPropertyId === property.id && { tintColor: colors.onAccent }]} resizeMode="contain" />
                  )}
                  {recording && recordingPropertyId === property.id && <View style={styles.micPulse} />}
                </Pressable>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 30 },
  heroBackground: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    minHeight: 180,
  },
  heroImage: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    opacity: 0.4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandLogo: {
    width: 120,
    height: 36,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: {
    width: 22,
    height: 22,
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  userName: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  orgDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orgDropdownIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  orgDropdownText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  orgDropdownCaret: {
    color: colors.textMuted,
    fontSize: 16,
  },
  orgDropdownMenu: {
    marginHorizontal: 20,
    backgroundColor: colors.menu,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  orgDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  orgDropdownItemActive: {
    backgroundColor: colors.accentSoft,
  },
  orgDropdownItemText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  orgDropdownItemTextActive: {
    color: colors.accent,
  },
  netCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  netCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  netValue: {
    fontSize: 32,
    fontWeight: '900',
    marginTop: 6,
    color: colors.textPrimary,
  },
  netSub: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  incExpRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  incExpBox: {
    flex: 1,
  },
  incExpLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  incomeValue: {
    color: colors.income,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  expenseValue: {
    color: colors.expense,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  card: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  seeAllText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  helper: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  propertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceFaint,
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
  },
  propertyImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.menu,
  },
  propertyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  propertyName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  propertyMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  propertyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordCountBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recordCountText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.repairSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.repairBorderSoft,
  },
  micButtonIcon: {
    width: 22,
    height: 22,
  },
  micButtonRecording: {
    backgroundColor: colors.expense,
    borderColor: colors.expense,
  },
  micPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.expenseGlow,
  },
  error: {
    color: colors.expense,
    marginHorizontal: 20,
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
  },
});
