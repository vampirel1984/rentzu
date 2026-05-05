import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import NewPropertyScreen from './src/screens/NewPropertyScreen';
import RecordFormScreen from './src/screens/RecordFormScreen';
import SummaryScreen from './src/screens/SummaryScreen';
import TaxReadyScreen from './src/screens/TaxReadyScreen';
import VerifyEmailScreen from './src/screens/VerifyEmailScreen';
import { Alert } from 'react-native';
import { clearSession, loadSession } from './src/services/api';
import { FinancialRecord } from './src/services/financialRecords';
import { createOrganization, listOrganizations, Organization } from './src/services/organizations';
import { BillingOverview, getBillingOverview, openBillingCheckout, openBillingPortal } from './src/services/billing';
import { Property } from './src/services/properties';

type HomeTab = 'summary' | 'property' | 'taxReady' | 'account';
type AppScreen = 'boot' | 'login' | 'verify' | 'home' | 'newProperty' | 'recordForm';
type RecordFormDraft = {
  type?: string;
  amount?: string;
  record_date?: string;
  description?: string;
  counterparty?: string;
  category_code?: string;
  sub_type?: string;
  notes?: string;
};

type RecordContext = {
  selectedUnitId?: string;
};

const NAV_ICONS = {
  summary: require('./assets/logo_14.png'),
  property: require('./assets/logo_15.png'),
  taxReady: require('./assets/logo_12.png'),
};

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('boot');
  const [editingProperty, setEditingProperty] = useState<Property | undefined>();
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | undefined>();
  const [recordFormDraft, setRecordFormDraft] = useState<RecordFormDraft | undefined>();
  const [recordContext, setRecordContext] = useState<RecordContext | undefined>();
  const [homeTab, setHomeTab] = useState<HomeTab>('summary');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState<string | undefined>();
  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [debugCode, setDebugCode] = useState<string | undefined>();
  const [deliveryMode, setDeliveryMode] = useState<'smtp' | 'outbox' | undefined>();
  const [requestMessage, setRequestMessage] = useState('');
  const [verifyDebugPayload, setVerifyDebugPayload] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | undefined>();
  const [selectedPropertySnapshot, setSelectedPropertySnapshot] = useState<Property | undefined>();
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const stored = await loadSession();
        if (stored) {
          setEmail(stored.session.email);
          setUserId(stored.session.userId);
          setOrganizationId(stored.session.organizationId);
          if (stored.session.userId) {
            const orgs = await listOrganizations(stored.session.userId).catch(() => []);
            setOrganizations(orgs);
          }
          setScreen('home');
          return;
        }
      } catch {}
      setScreen('login');
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!organizationId || screen !== 'home') {
        setBillingOverview(null);
        return;
      }
      try {
        const billing = await getBillingOverview(organizationId);
        setBillingOverview(billing);
      } catch {
        setBillingOverview(null);
      }
    })();
  }, [organizationId, screen, homeRefreshKey]);

  const formatMoney = (value?: string | number | null) => {
    const amount = Number(value || 0);
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const formatCents = (value: number) => formatMoney(value / 100);

  const planName = billingOverview?.subscription_status && billingOverview.subscription_status !== 'free'
    ? 'Pro'
    : (billingOverview?.billable_units || 0) > 0
      ? 'Free trial'
      : 'Free';

  const manageBillingLabel = billingBusy
    ? 'Opening...'
    : billingOverview?.customer_portal_available
      ? 'Manage billing'
      : billingOverview?.checkout_available
        ? 'Start subscription'
        : billingOverview?.stripe_configured
          ? 'Billing unavailable'
          : 'Set up billing';

  const planDescription = billingOverview?.customer_portal_available
    ? 'Manage your Stripe subscription and payment method.'
    : billingOverview?.checkout_available
      ? `First ${billingOverview.free_units} unit${billingOverview.free_units === 1 ? '' : 's'} free, then ${formatCents(billingOverview.amount_per_unit_cents)} per extra unit each month.`
      : (billingOverview?.billable_units || 0) > 0
        ? 'Billing is not fully configured yet.'
        : 'You are currently within the free allowance.';

  return (
    <>
      <StatusBar style="light" />
      {screen === 'boot' && (
        <SafeAreaView style={styles.bootContainer}>
          <Image source={require('./assets/logo_1.png')} style={styles.bootLogo} resizeMode="contain" />
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.bootText}>Loading RentZu...</Text>
        </SafeAreaView>
      )}
      {screen === 'login' && (
        <LoginScreen
          onSuccess={(result) => {
            setEmail(result.email);
            setUserId(result.user_id);
            setDebugCode(result.debug_code);
            setDeliveryMode(result.delivery_mode);
            setRequestMessage(result.message);
            if (result.user_id) {
              listOrganizations(result.user_id).then(setOrganizations).catch(() => undefined);
            }
            if (result.organization_id) {
              setOrganizationId(result.organization_id);
              setScreen('home');
            } else {
              setScreen('verify');
            }
          }}
        />
      )}
      {screen === 'verify' && (
        <VerifyEmailScreen
          email={email}
          debugCode={debugCode}
          deliveryMode={deliveryMode}
          requestMessage={requestMessage}
          onDebugPayload={setVerifyDebugPayload}
          onBack={() => setScreen('login')}
          onVerified={(result) => {
            setUserId(result.user_id);
            setOrganizationId(result.organization_id);
            if (result.user_id) {
              listOrganizations(result.user_id).then(setOrganizations).catch(() => undefined);
            }
            setScreen('home');
          }}
        />
      )}
      {screen === 'verify' && !!verifyDebugPayload && (
        <View style={styles.debugBanner}>
          <Text style={styles.debugBannerText}>{verifyDebugPayload}</Text>
        </View>
      )}
      {screen === 'home' && (
        <View style={styles.appShell}>
          <View style={styles.screenArea}>
            {homeTab === 'summary' && (
              <SummaryScreen
                organizationId={organizationId}
                userId={userId}
                email={email}
                organization={organizations.find((org) => org.id === organizationId)}
                organizations={organizations}
                selectedPropertyId={selectedPropertyId}
                refreshKey={homeRefreshKey}
                onSelectProperty={setSelectedPropertyId}
                onSelectOrganization={setOrganizationId}
                onOpenPropertyTab={() => setHomeTab('property')}
                onOpenNewProperty={() => {
                  setEditingProperty(undefined);
                  setScreen('newProperty');
                }}
                onEditProperty={(property) => {
                  setEditingProperty(property);
                  setScreen('newProperty');
                }}
                onQuickAddRecord={(property) => {
                  setSelectedPropertyId(property.id);
                  setSelectedPropertySnapshot(property);
                  setEditingRecord(undefined);
                  setRecordFormDraft(undefined);
                  setRecordContext(undefined);
                  setScreen('recordForm');
                }}
                onOrganizationUpdated={(updated) => {
                  setOrganizations((prev) => prev.map((org) => (org.id === updated.id ? updated : org)));
                }}
              />
            )}
            {homeTab === 'property' && (
              <HomeScreen
                email={email}
                userId={userId}
                organizationId={organizationId}
                organizations={organizations}
                selectedPropertyId={selectedPropertyId}
                refreshKey={homeRefreshKey}
                onSelectedPropertyChange={setSelectedPropertySnapshot}
                onSelectOrganization={setOrganizationId}
                onBack={() => setHomeTab('summary')}
                onOpenRecordForm={(payload) => {
                  setEditingRecord(payload.record);
                  setRecordFormDraft(payload.draft);
                  setRecordContext({ selectedUnitId: payload.selectedUnitId });
                  if (payload.property) {
                    setSelectedPropertyId(payload.property.id);
                    setSelectedPropertySnapshot(payload.property);
                  }
                  setScreen('recordForm');
                }}
              />
            )}
            {homeTab === 'taxReady' && (
              <TaxReadyScreen
                organizationId={organizationId}
                organizations={organizations}
                selectedPropertyId={selectedPropertyId}
                refreshKey={homeRefreshKey}
                onSelectProperty={setSelectedPropertyId}
                onSelectOrganization={setOrganizationId}
              />
            )}
            {homeTab === 'account' && (
              <SafeAreaView style={styles.accountContainer}>
                <Text style={styles.accountTitle}>Account</Text>
                <Text style={styles.accountEmail}>{email}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.orgBar} contentContainerStyle={styles.orgBarContent}>
                  {!!userId && organizations.length > 0 && (
                    <>
                      {organizations.map((org) => (
                        <Pressable key={org.id} style={[styles.orgChip, org.id === organizationId && styles.orgChipActive]} onPress={() => setOrganizationId(org.id)}>
                          <Text style={[styles.orgChipText, org.id === organizationId && styles.orgChipTextActive]}>{org.name}</Text>
                        </Pressable>
                      ))}
                    </>
                  )}
                </ScrollView>

                <View style={styles.accountCard}>
                  <Text style={styles.accountCardTitle}>Organizations</Text>
                  <Text style={styles.accountCardBody}>Create and switch owner groups from one place.</Text>
                  <Pressable
                    style={styles.primaryActionButton}
                    onPress={async () => {
                      if (!userId) return;
                      try {
                        const nextName = `Workspace ${organizations.length + 1}`;
                        const created = await createOrganization(userId, { name: nextName, entity_type: 'llc' });
                        const orgs = await listOrganizations(userId);
                        setOrganizations(orgs);
                        setOrganizationId(created.id);
                        setHomeRefreshKey((value) => value + 1);
                        Alert.alert('Organization created', `${nextName} is ready. You can rename it next.`);
                      } catch (err) {
                        Alert.alert('Could not create organization', err instanceof Error ? err.message : 'Unknown error');
                      }
                    }}
                  >
                    <Text style={styles.primaryActionButtonText}>Create organization</Text>
                  </Pressable>
                </View>

                <View style={styles.accountCard}>
                  <View style={styles.planHeader}>
                    <Text style={styles.accountCardTitle}>Plan</Text>
                    <View style={styles.proBadge}><Text style={styles.proBadgeText}>{planName}</Text></View>
                  </View>
                  <Text style={styles.planPrice}>
                    {billingOverview ? formatCents(billingOverview.estimated_monthly_total_cents || 0) : '$0.00'}
                    <Text style={styles.planPeriod}> / month</Text>
                  </Text>
                  <Text style={styles.accountCardBody}>{planDescription}</Text>
                  <Pressable style={[styles.primaryActionButton, (!billingBusy && !billingOverview?.customer_portal_available && !billingOverview?.checkout_available) ? styles.primaryActionButtonDisabled : null]} onPress={async () => {
                    if (!organizationId) return;
                    try {
                      setBillingBusy(true);
                      if (billingOverview?.customer_portal_available) {
                        await openBillingPortal(organizationId);
                      } else if (billingOverview?.checkout_available) {
                        await openBillingCheckout(organizationId);
                      } else if (!billingOverview?.stripe_configured) {
                        Alert.alert('Billing setup needed', 'Stripe is not fully configured on the server yet.');
                      } else {
                        Alert.alert('Billing', 'There is nothing to manage yet for this workspace. Add more billable units or complete checkout first.');
                      }
                    } catch (err) {
                      Alert.alert('Billing', err instanceof Error ? err.message : 'Could not open billing');
                    } finally {
                      setBillingBusy(false);
                    }
                  }} disabled={billingBusy}>
                    <Text style={styles.primaryActionButtonText}>{manageBillingLabel}</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={styles.logoutButton}
                  onPress={async () => {
                    await clearSession();
                    setEmail('');
                    setUserId(undefined);
                    setOrganizationId(undefined);
                    setOrganizations([]);
                    setScreen('login');
                  }}
                >
                  <Text style={styles.logoutText}>Sign Out</Text>
                </Pressable>
              </SafeAreaView>
            )}
          </View>
          <View style={styles.bottomBar}>
            {([
              { key: 'summary' as HomeTab, label: 'Summary', icon: NAV_ICONS.summary },
              { key: 'property' as HomeTab, label: 'Property', icon: NAV_ICONS.property },
              { key: 'taxReady' as HomeTab, label: 'Tax Ready', icon: NAV_ICONS.taxReady },
              { key: 'account' as HomeTab, label: 'Account', icon: null },
            ]).map((item) => {
              const active = homeTab === item.key;
              return (
                <Pressable key={item.key} style={styles.navItem} onPress={() => setHomeTab(item.key)}>
                  {item.icon ? (
                    <Image source={item.icon} style={[styles.navIconImage, active && styles.navIconImageActive]} resizeMode="contain" />
                  ) : (
                    <Text style={[styles.navIcon, active && styles.navIconActive]}>👤</Text>
                  )}
                  <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
                  {active && <View style={styles.navIndicator} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      {screen === 'newProperty' && (
        <NewPropertyScreen
          organizationId={organizationId}
          initialProperty={editingProperty}
          onBack={() => setScreen('home')}
          onSaved={(property: Property) => {
            setEditingProperty(undefined);
            setSelectedPropertyId(property.id);
            setSelectedPropertySnapshot(property);
            setHomeRefreshKey((value) => value + 1);
            setHomeTab(editingProperty ? 'summary' : 'property');
            setScreen('home');
          }}
        />
      )}
      {screen === 'recordForm' && (
        <RecordFormScreen
          organizationId={organizationId}
          selectedProperty={selectedPropertySnapshot}
          userId={userId}
          selectedUnitId={recordContext?.selectedUnitId}
          initialRecord={editingRecord}
          initialDraft={recordFormDraft}
          onBack={() => {
            setEditingRecord(undefined);
            setRecordFormDraft(undefined);
            setRecordContext(undefined);
            setHomeTab('property');
            setHomeRefreshKey((value) => value + 1);
            setScreen('home');
          }}
          onSaved={() => {
            setEditingRecord(undefined);
            setRecordFormDraft(undefined);
            setRecordContext(undefined);
            setHomeRefreshKey((value) => value + 1);
            setHomeTab('property');
            setScreen('home');
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0e1a',
    padding: 24,
  },
  bootLogo: {
    width: 180,
    height: 60,
    marginBottom: 24,
  },
  bootText: {
    marginTop: 16,
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  appShell: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  screenArea: {
    flex: 1,
  },
  accountContainer: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    padding: 20,
    paddingTop: 60,
  },
  accountTitle: {
    color: '#f1f5f9',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  accountEmail: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 24,
  },
  orgBar: {
    flexGrow: 0,
    marginBottom: 24,
  },
  orgBarContent: {
    flexDirection: 'row',
    gap: 8,
  },
  orgChip: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  orgChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  orgChipText: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '700',
  },
  orgChipTextActive: {
    color: '#fff',
  },
  accountCard: {
    backgroundColor: 'rgba(17,24,39,0.8)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(55,65,81,0.5)',
    marginBottom: 16,
  },
  accountCardTitle: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  accountCardBody: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  primaryActionButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#22c55e',
  },
  primaryActionButtonDisabled: {
    backgroundColor: '#334155',
  },
  primaryActionButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  proBadge: {
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  proBadgeText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '800',
  },
  planPrice: {
    color: '#f1f5f9',
    fontSize: 28,
    fontWeight: '900',
  },
  planPeriod: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: '800',
    fontSize: 15,
  },
  debugBanner: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  debugBannerText: {
    color: '#f9fafb',
    fontSize: 11,
    fontWeight: '600',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(17,24,39,0.98)',
    borderTopWidth: 1,
    borderColor: 'rgba(55,65,81,0.5)',
    paddingVertical: 10,
    paddingBottom: 28,
    paddingHorizontal: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
    position: 'relative',
  },
  navIconImage: {
    width: 24,
    height: 24,
    opacity: 0.5,
  },
  navIconImageActive: {
    opacity: 1,
  },
  navIcon: {
    fontSize: 22,
    opacity: 0.5,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  navLabelActive: {
    color: '#3b82f6',
  },
  navIndicator: {
    position: 'absolute',
    top: -10,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#3b82f6',
  },
});
