// Modified by AI on 07/03/2026. Edit #1.
// Modified by AI on 07/18/2026. Edit #2.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-chart-kit';

import { deleteFinancialRecord, FinancialRecord, listFinancialRecords, updateFinancialRecord } from '../services/financialRecords';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { listProperties, Property, PropertyUnit } from '../services/properties';
import { updateUnit } from '../services/units';
import { Organization } from '../services/organizations';
import { colors } from '../theme/tokens';

const editIcon = require('../../assets/logo_10.png');
const micIcon = require('../../assets/logo_7.png');
const houseIcon = require('../../assets/logo_6.png');
const buildingIcon = require('../../assets/logo_5.png');
const repairIcon = require('../../assets/logo_17.png');
const expenseIcon = require('../../assets/logo_13.png');

type Props = {
  email: string;
  organizationId?: string;
  userId?: string;
  organizations?: Organization[];
  selectedPropertyId?: string;
  refreshKey?: number;
  onSelectedPropertyChange?: (property?: Property) => void;
  onSelectOrganization?: (orgId: string) => void;
  onBack?: () => void;
  onOpenRecordForm: (payload: { record?: FinancialRecord; draft?: RecordFormDraft; property?: Property; selectedUnitId?: string }) => void;
};

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

// Large page size used when loading a property's full record set into memory
// up front (see fetchAllPropertyRecords) so unit/property switches are
// instant client-side filters instead of new network round-trips.
const ALL_RECORDS_PAGE_SIZE = 100; // backend caps `limit` at 100 (financial_records_index: le=100)
const ALL_RECORDS_MAX_PAGES = 50; // safety cap (~10k records) against runaway pagination loops

const CATEGORY_LABELS: Record<string, string> = {
  rent: 'Rent',
  additional_income: 'Income',
  legal: 'Legal',
  utility: 'Utility',
  cleaning: 'Cleaning',
  management: 'Management',
  maintenance: 'Maintenance',
  repair: 'Repair',
  other: 'Other',
  travel: 'Travel',
  commission: 'Commission',
  interest: 'Mortgage Interest',
  mortgage: 'Mortgage Principal',
  improvement: 'Improvement',
  insurance: 'Insurance',
  tax: 'Tax',
};

const formatMoney = (value?: string | number | null): string => {
  const amount = Number(value || 0);
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const formatPropertyType = (value?: string): string => {
  if (!value) return 'Property';
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};

const formatCategoryLabel = (value?: string | null): string => {
  if (!value) return 'Uncategorized';
  return CATEGORY_LABELS[value] || value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};

// Fetches every page of financial records for a property in one go (not
// unit-scoped) so the client can hold the full set in memory and filter by
// unit instantly, without a server round-trip per unit/property switch.
const fetchAllPropertyRecords = async (organizationId: string, propertyId: string) => {
  const all: FinancialRecord[] = [];
  let cursor: string | undefined;
  let total = 0;
  for (let page = 0; page < ALL_RECORDS_MAX_PAGES; page += 1) {
    const response = await listFinancialRecords(organizationId, propertyId, ALL_RECORDS_PAGE_SIZE, cursor);
    all.push(...response.items);
    total = response.total;
    cursor = response.next_cursor || undefined;
    if (!cursor) break;
  }
  return { items: all, total };
};

type ComputedTaxReport = {
  income_total: number;
  expense_total: number;
  net_total: number;
  record_count: number;
  monthly_totals: { month: string; income: string; expense: string; net: string }[];
};

// Mirrors the server's build_property_tax_report aggregation (income/expense/
// net totals + monthly breakdown for a given year and optional unit), but
// computed client-side from an already-loaded record set so switching units
// or back to the whole property is instant with no loading state.
const computeTaxReport = (allRecords: FinancialRecord[], unitId: string | undefined, year: number): ComputedTaxReport => {
  const monthlyMap = new Map<string, { income: number; expense: number; net: number }>();
  let income = 0;
  let expense = 0;
  let recordCount = 0;

  for (const record of allRecords) {
    if (unitId && record.unit_id !== unitId) continue;
    const recordYear = Number(record.record_date?.slice(0, 4));
    if (recordYear !== year) continue;

    recordCount += 1;
    const amount = Number(record.amount) || 0;
    const monthKey = record.record_date.slice(0, 7);
    if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, { income: 0, expense: 0, net: 0 });
    const bucket = monthlyMap.get(monthKey)!;

    if ((record.type || '').toLowerCase() === 'income') {
      income += amount;
      bucket.income += amount;
      bucket.net += amount;
    } else {
      expense += amount;
      bucket.expense += amount;
      bucket.net -= amount;
    }
  }

  const monthly_totals = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, totals]) => ({
      month,
      income: String(totals.income),
      expense: String(totals.expense),
      net: String(totals.net),
    }));

  return {
    income_total: income,
    expense_total: expense,
    net_total: income - expense,
    record_count: recordCount,
    monthly_totals,
  };
};

const screenWidth = Dimensions.get('window').width;

export default function HomeScreen({
  email: _email, organizationId, userId, organizations,
  selectedPropertyId: selectedPropertyIdProp, refreshKey,
  onSelectedPropertyChange, onSelectOrganization, onBack, onOpenRecordForm,
}: Props) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | undefined>(selectedPropertyIdProp);
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>();
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'documents'>('overview');
  // Holds every financial record for the selected property (all units,
  // unfiltered), fetched once per property load. Selecting a unit or
  // switching back to the whole property just filters this in memory —
  // no server round-trip, so there's no loading flicker on switch.
  const [allRecords, setAllRecords] = useState<FinancialRecord[]>([]);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const selectionRequestRef = useRef(0);

  const selectedProperty = useMemo(
    () => properties.find((item) => item.id === selectedPropertyId),
    [properties, selectedPropertyId],
  );

  // Client-side filter of the in-memory record set by the selected unit —
  // instant, no network call.
  const records = useMemo(
    () => (selectedUnitId ? allRecords.filter((r) => r.unit_id === selectedUnitId) : allRecords),
    [allRecords, selectedUnitId],
  );
  const recordsTotal = records.length;

  // Client-side aggregation of the in-memory record set, mirroring the
  // server's tax-report math (see computeTaxReport above) — instant, no
  // network call on unit/property switch.
  const taxReport = useMemo(
    () => (selectedPropertyId ? computeTaxReport(allRecords, selectedUnitId, currentYear) : null),
    [allRecords, selectedUnitId, currentYear, selectedPropertyId],
  );

  const refreshData = useCallback(async (nextPropertyId?: string) => {
    if (!organizationId) return;
    const requestId = ++selectionRequestRef.current;
    setLoading(true);
    try {
      const propertyRows = await listProperties(organizationId);
      if (requestId !== selectionRequestRef.current) return;
      setProperties(propertyRows);
      const requestedPropertyId = nextPropertyId ?? selectedPropertyId ?? selectedPropertyIdProp;
      const fallbackPropertyId = propertyRows[0]?.id;
      const activePropertyId = propertyRows.some((item) => item.id === requestedPropertyId) ? requestedPropertyId : fallbackPropertyId;
      const activeProperty = propertyRows.find((item) => item.id === activePropertyId);
      setSelectedPropertyId(activePropertyId);
      setSelectedUnitId(undefined);
      onSelectedPropertyChange?.(activeProperty);

      if (activePropertyId) {
        const { items } = await fetchAllPropertyRecords(organizationId, activePropertyId);
        if (requestId !== selectionRequestRef.current) return;
        setAllRecords(items);
      } else {
        setAllRecords([]);
      }
      setError('');
    } catch (err) {
      if (requestId !== selectionRequestRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load property records.');
    } finally {
      if (requestId === selectionRequestRef.current) setLoading(false);
    }
  }, [onSelectedPropertyChange, organizationId, selectedPropertyIdProp]);

  // Selecting a unit (or tapping back to the whole property with
  // unitId=undefined) is a pure client-side switch over the already-loaded
  // allRecords/taxReport — no server call, no loading state.
  const handleSelectUnit = useCallback((unitId?: string) => {
    setSelectedUnitId((prev) => (prev === unitId ? prev : unitId));
  }, []);

  const handleUnitFieldSave = useCallback(async (unit: PropertyUnit, field: 'unit_code' | 'tenant_name', rawValue: string) => {
    const value = rawValue.trim();
    const current = field === 'unit_code' ? unit.unit_code : (unit.tenant_name || '');
    if (value === (current || '')) return;
    if (field === 'unit_code' && !value) return;
    try {
      const updated = await updateUnit(unit.id, field === 'tenant_name' ? { tenant_name: value || null } : { unit_code: value });
      setProperties((prev) => prev.map((p) => p.id === unit.property_id
        ? { ...p, units: (p.units || []).map((u) => (u.id === unit.id ? { ...u, ...updated } : u)) }
        : p));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save unit.');
    }
  }, []);

  useEffect(() => {
    if (selectedPropertyIdProp) setSelectedPropertyId(selectedPropertyIdProp);
  }, [selectedPropertyIdProp]);

  useEffect(() => {
    if (organizationId) refreshData(selectedPropertyIdProp);
  }, [organizationId, refreshData, refreshKey, selectedPropertyIdProp]);

  useEffect(() => {
    if (selectedProperty) onSelectedPropertyChange?.(selectedProperty);
  }, [onSelectedPropertyChange, selectedProperty]);

  const { recording, recordingPropertyId, transcribing, voiceError, handleVoicePress } = useVoiceRecorder({
    organizationId,
    userId,
    onInserted: async () => {
      await refreshData(selectedPropertyId);
    },
    onFallback: (_propertyId, draft) => {
      onOpenRecordForm({ draft: draft as RecordFormDraft, property: selectedProperty, selectedUnitId });
    },
  });

  const handleVoiceButton = () => {
    if (!selectedPropertyId) return;
    handleVoicePress(selectedPropertyId, selectedProperty?.name);
  };

  const handleDeleteRecord = (record: FinancialRecord) => {
    Alert.alert('Delete record?', `Delete "${record.description}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            setSavingRecord(true);
            await deleteFinancialRecord(record.id);
            await refreshData(selectedPropertyId);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete record.');
          } finally {
            setSavingRecord(false);
          }
        },
      },
    ]);
  };

  const getPropertyIcon = (type?: string) => {
    if (!type) return houseIcon;
    const t = type.toLowerCase();
    if (t.includes('single') || t.includes('house') || t.includes('sfr')) return houseIcon;
    return buildingIcon;
  };

  // Build chart data from tax report monthly totals
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const values = new Array(12).fill(0);
    taxReport?.monthly_totals?.forEach((mt) => {
      const monthIndex = parseInt(mt.month.split('-')[1], 10) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        values[monthIndex] = Math.abs(Number(mt.net));
      }
    });

    const monthsWithData = values
      .map((value, index) => ({ value, index }))
      .filter((item) => item.value > 0)
      .map((item) => item.index);

    let labelIndexes = [0, 3, 6, 9];
    if (monthsWithData.length > 0) {
      const start = Math.max(0, monthsWithData[0] - 1);
      const end = Math.min(11, monthsWithData[monthsWithData.length - 1] + 1);
      const span = end - start + 1;
      if (span <= 4) {
        labelIndexes = Array.from({ length: span }, (_, i) => start + i);
      } else {
        const step = (end - start) / 3;
        labelIndexes = [0, 1, 2, 3].map((i) => Math.min(11, Math.round(start + step * i)));
        labelIndexes = Array.from(new Set(labelIndexes)).sort((a, b) => a - b);
        while (labelIndexes.length < 4) {
          const next = Math.min(11, (labelIndexes[labelIndexes.length - 1] ?? start) + 1);
          if (labelIndexes.includes(next)) break;
          labelIndexes.push(next);
        }
      }
    }

    const labels = labelIndexes.map((index) => months[index]);
    const displayValues = labelIndexes.map((index) => values[index]);
    return {
      labels,
      datasets: [{ data: displayValues.every(v => v === 0) ? new Array(labels.length).fill(0) : displayValues }],
    };
  }, [taxReport]);

  const cashFlowNet = useMemo(() => {
    if (!taxReport) return 0;
    return Number(taxReport.net_total || 0);
  }, [taxReport]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{selectedProperty?.name || 'Property'}</Text>
          <Pressable style={styles.menuButton}>
            <Text style={styles.menuDots}>•••</Text>
          </Pressable>
        </View>

        {/* Organization Pill */}
        <Pressable style={styles.orgPill} onPress={() => setOrgDropdownOpen(!orgDropdownOpen)}>
          <Text style={styles.orgPillIcon}>🏢</Text>
          <Text style={styles.orgPillText}>{organizations?.find(o => o.id === organizationId)?.name || 'Organization'}</Text>
          <Text style={styles.orgPillCaret}>▾</Text>
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

        {/* Property + Units selectable group */}
        {selectedProperty && (
          <View style={styles.propertyGroup}>
            <Pressable
              style={[styles.propertyRow, !selectedUnitId && styles.propertyRowSelected]}
              onPress={() => handleSelectUnit(undefined)}>
              <Image source={getPropertyIcon(selectedProperty.property_type)} style={styles.propertyImage} resizeMode="cover" />
              <View style={styles.propertyInfoText}>
                <Text style={styles.propertyInfoName}>{selectedProperty.name}</Text>
                <Text style={styles.propertyInfoMeta}>
                  {formatPropertyType(selectedProperty.property_type)} · {selectedProperty.total_units} {selectedProperty.total_units === 1 ? 'unit' : 'units'}
                </Text>
              </View>
              <Pressable style={styles.editButton}>
                <Image source={editIcon} style={styles.editButtonIcon} resizeMode="contain" />
              </Pressable>
            </Pressable>

            {(selectedProperty.units?.length || 0) > 0 && (
              <View style={styles.unitList}>
                {selectedProperty.units?.map((unit) => (
                  <Pressable
                    key={unit.id}
                    style={[styles.unitTablet, selectedUnitId === unit.id && styles.unitTabletSelected]}
                    onPress={() => handleSelectUnit(unit.id)}>
                    <TextInput
                      style={styles.unitCodeInput}
                      defaultValue={unit.unit_code}
                      selectTextOnFocus
                      placeholder="Unit"
                      placeholderTextColor={colors.textMuted}
                      onFocus={() => handleSelectUnit(unit.id)}
                      onEndEditing={(e) => handleUnitFieldSave(unit, 'unit_code', e.nativeEvent.text)}
                    />
                    <TextInput
                      style={styles.unitTenantInput}
                      defaultValue={unit.tenant_name || ''}
                      placeholder="Add tenant name"
                      placeholderTextColor={colors.textMuted}
                      onFocus={() => handleSelectUnit(unit.id)}
                      onEndEditing={(e) => handleUnitFieldSave(unit, 'tenant_name', e.nativeEvent.text)}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {(['overview', 'records', 'documents'] as const).map((tab) => (
            <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
        {loading && <ActivityIndicator style={{ marginTop: 12 }} color={colors.accent} />}

        {activeTab === 'overview' && (
          <>
            {/* Cash Flow Section */}
            <View style={styles.card}>
              <View style={styles.cashFlowHeader}>
                <View>
                  <Text style={styles.cashFlowLabel}>Net cash flow (YTD)</Text>
                  <Text style={styles.cashFlowValue}>{formatMoney(cashFlowNet)}</Text>
                </View>
              </View>

              {/* Bar Chart */}
              <View style={styles.chartWrap}>
                <BarChart
                  data={chartData}
                  width={screenWidth - 80}
                  height={140}
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundColor: 'transparent',
                    backgroundGradientFrom: colors.chartBase,
                    backgroundGradientTo: colors.chartBase,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                    labelColor: () => colors.textMuted,
                    barPercentage: 0.6,
                    propsForBackgroundLines: { stroke: colors.dividerSubtle },
                  }}
                  style={{ borderRadius: 12 }}
                  withInnerLines={false}
                  showValuesOnTopOfBars={false}
                  fromZero
                />
              </View>
            </View>

            {/* Income / Expenses / Records Summary */}
            <View style={styles.metricsRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Income</Text>
                <Text style={styles.metricValueGreen}>{formatMoney(taxReport?.income_total)}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Expenses</Text>
                <Text style={styles.metricValueRed}>{formatMoney(taxReport?.expense_total)}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Records</Text>
                <View style={styles.recordsCountWrap}>
                  <Text style={styles.metricValueBlue}>📋</Text>
                  <Text style={styles.metricValueBlue}> {taxReport?.record_count || 0}</Text>
                </View>
              </View>
            </View>

            {/* Quick Record */}
            <View style={styles.card}>
              <View style={styles.quickRecordHeader}>
                <Text style={styles.cardTitle}>Quick record</Text>
                <Pressable onPress={() => onOpenRecordForm({ property: selectedProperty, selectedUnitId })}>
                  <Text style={styles.addTransactionLink}>Add transaction</Text>
                </Pressable>
              </View>
              <View style={styles.quickRecordButtons}>
                <Pressable style={styles.quickButton} onPress={() => onOpenRecordForm({ draft: { type: 'income', category_code: 'rent' }, property: selectedProperty })}>
                  <View style={[styles.quickButtonCircle, { backgroundColor: colors.incomeSoft }]}>
                    <Text style={styles.quickButtonEmoji}>🏠</Text>
                  </View>
                  <Text style={styles.quickButtonLabel}>Rent</Text>
                </Pressable>
                <Pressable style={styles.quickButton} onPress={() => onOpenRecordForm({ draft: { type: 'expense' }, property: selectedProperty })}>
                  <View style={[styles.quickButtonCircle, { backgroundColor: colors.expenseSoft }]}>
                    <Image source={expenseIcon} style={styles.quickButtonIcon} resizeMode="contain" />
                  </View>
                  <Text style={styles.quickButtonLabel}>Expense</Text>
                </Pressable>
                <Pressable style={styles.quickButton} onPress={() => onOpenRecordForm({ draft: { type: 'improvement', category_code: 'improvement' }, property: selectedProperty })}>
                  <View style={[styles.quickButtonCircle, { backgroundColor: colors.repairSoft }]}>
                    <Text style={styles.quickButtonEmoji}>🏗️</Text>
                  </View>
                  <Text style={styles.quickButtonLabel}>Improvements</Text>
                </Pressable>
              </View>
            </View>

            {/* Recent Records */}
            <View style={styles.card}>
              <View style={styles.quickRecordHeader}>
                <Text style={styles.cardTitle}>Recent records</Text>
                <Pressable onPress={() => setActiveTab('records')}>
                  <Text style={styles.addTransactionLink}>View all</Text>
                </Pressable>
              </View>
              {records.length === 0 && <Text style={styles.helper}>No records yet for this property.</Text>}
              {records.slice(0, 5).map((record) => (
                <View key={record.id} style={styles.recordRow}>
                  <Pressable style={styles.recordInfo}
                    onPress={() => onOpenRecordForm({ record, property: selectedProperty, selectedUnitId: record.unit_id || undefined })}>
                    <Text style={styles.recordDate}>{record.record_date} · {record.description}</Text>
                    <View style={styles.recordMetaRow}>
                      <Text style={styles.recordMeta}>{record.type} · {record.counterparty || 'No counterparty'}</Text>
                      <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{formatCategoryLabel(record.category_code)}</Text></View>
                    </View>
                  </Pressable>
                  <View style={styles.recordRight}>
                    <Text style={[styles.recordAmount, { color: record.type === 'income' ? colors.income : colors.expense }]}>
                      {record.type === 'income' ? '' : '-'}{formatMoney(record.amount)}
                    </Text>
                    <View style={styles.recordActionsRow}>
                      <Pressable onPress={() => onOpenRecordForm({ record, property: selectedProperty })}>
                        <Text style={styles.editLink}>Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => handleDeleteRecord(record)} disabled={savingRecord}>
                        <Text style={styles.deleteLink}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {activeTab === 'records' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>All Records ({records.length})</Text>
            {records.length === 0 && <Text style={styles.helper}>No records yet.</Text>}
            {records.map((record) => (
              <View key={record.id} style={styles.recordRow}>
                <View style={styles.recordInfo}>
                  <Text style={styles.recordDate}>{record.record_date} · {record.description}</Text>
                  <View style={styles.recordMetaRow}>
                    <Text style={styles.recordMeta}>{record.type} · {record.counterparty || 'No counterparty'}</Text>
                    <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{formatCategoryLabel(record.category_code)}</Text></View>
                  </View>
                </View>
                <View style={styles.recordRight}>
                  <Text style={[styles.recordAmount, { color: record.type === 'income' ? colors.income : colors.expense }]}>
                    {record.type === 'income' ? '' : '-'}{formatMoney(record.amount)}
                  </Text>
                  <View style={styles.recordActionsRow}>
                    <Pressable onPress={() => onOpenRecordForm({ record, property: selectedProperty })}>
                      <Text style={styles.editLink}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => handleDeleteRecord(record)} disabled={savingRecord}>
                      <Text style={styles.deleteLink}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'documents' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Documents</Text>
            <Text style={styles.helper}>Property documents will appear here. Upload receipts, leases, and other files.</Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Microphone FAB — always visible on overview & records */}
      {(activeTab === 'overview' || activeTab === 'records') && (
        <Pressable
          style={[styles.micFab, (recording || transcribing) && styles.micFabActive]}
          onPress={handleVoiceButton}
          disabled={transcribing}
        >
          {transcribing ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Image source={micIcon} style={styles.micFabIcon} resizeMode="contain" />
          )}
          {recording && <View style={styles.micFabPulse} />}
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDots: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  orgPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surfaceStrong,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orgPillIcon: { fontSize: 14, marginRight: 6 },
  orgPillText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  orgPillCaret: { color: colors.textMuted, fontSize: 14, marginLeft: 6 },
  orgDropdownMenu: {
    marginHorizontal: 60,
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
  orgDropdownItemActive: { backgroundColor: colors.accentSoft },
  orgDropdownItemText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  orgDropdownItemTextActive: { color: colors.accent },
  propertyGroup: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  propertyRowSelected: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.accent,
  },
  unitList: {
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 2,
  },
  unitTablet: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 6,
    backgroundColor: colors.menu,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  unitTabletSelected: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.accent,
  },
  unitCodeInput: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    minWidth: 52,
    maxWidth: 88,
    paddingVertical: 0,
  },
  unitTenantInput: {
    flex: 1,
    marginLeft: 10,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 0,
  },
  propertyImage: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.menu,
  },
  propertyInfoText: { flex: 1, marginLeft: 12 },
  propertyInfoName: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  propertyInfoMeta: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 3 },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonIcon: { width: 20, height: 20 },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerSubtle,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  tabText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: colors.accent },
  card: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  cashFlowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cashFlowLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  cashFlowValue: { color: colors.textPrimary, fontSize: 28, fontWeight: '900', marginTop: 4 },
  voiceCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.repairSoftStrong,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.repairBorder,
  },
  voiceCircleIcon: { width: 22, height: 22 },
  chartWrap: {
    marginTop: 12,
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    gap: 10,
  },
  metricBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  metricLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  metricValueGreen: { color: colors.income, fontSize: 16, fontWeight: '800', marginTop: 4 },
  metricValueRed: { color: colors.expense, fontSize: 16, fontWeight: '800', marginTop: 4 },
  metricValueBlue: { color: colors.accent, fontSize: 16, fontWeight: '800', marginTop: 4 },
  recordsCountWrap: { flexDirection: 'row', alignItems: 'center' },
  quickRecordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  addTransactionLink: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  quickRecordButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickButton: {
    alignItems: 'center',
    minWidth: 64,
  },
  quickButtonCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickButtonEmoji: { fontSize: 24 },
  quickButtonIcon: { width: 28, height: 28 },
  quickButtonLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerSubtle,
  },
  recordInfo: { flex: 1, paddingRight: 12 },
  recordDate: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  recordMeta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  recordRight: { alignItems: 'flex-end' },
  recordAmount: { fontSize: 14, fontWeight: '800' },
  recordChevron: { color: colors.textMuted, fontSize: 20, marginTop: 2 },
  recordActionsRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  editLink: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  deleteLink: { color: colors.expense, fontSize: 12, fontWeight: '700' },
  helper: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  error: { color: colors.expense, marginHorizontal: 20, marginTop: 12, fontSize: 13, fontWeight: '700' },
  loadMoreButton: {
    marginTop: 14,
    backgroundColor: colors.accentFaint,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loadMoreText: { color: colors.accent, fontWeight: '800', fontSize: 13 },
  micFab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.repair,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.repair,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  micFabActive: {
    backgroundColor: colors.expense,
    shadowColor: colors.expense,
  },
  micFabIcon: {
    width: 30,
    height: 30,
    tintColor: colors.onAccent,
  },
  micFabPulse: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: colors.expenseGlow,
  },
  recordMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  categoryBadge: {
    backgroundColor: colors.accentBadge,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryBadgeText: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: '700',
  },
});
