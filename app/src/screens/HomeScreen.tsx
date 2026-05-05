import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-chart-kit';

import { deleteFinancialRecord, FinancialRecord, listFinancialRecords, updateFinancialRecord } from '../services/financialRecords';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { listProperties, Property, getPropertyTaxReport, PropertyTaxReport } from '../services/properties';
import { Organization } from '../services/organizations';

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

const RECORDS_PAGE_SIZE = 5;

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
  interest: 'Interest',
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

const screenWidth = Dimensions.get('window').width;

export default function HomeScreen({
  email: _email, organizationId, userId, organizations,
  selectedPropertyId: selectedPropertyIdProp, refreshKey,
  onSelectedPropertyChange, onSelectOrganization, onBack, onOpenRecordForm,
}: Props) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | undefined>(selectedPropertyIdProp);
  const [selectedRecordId, setSelectedRecordId] = useState<string | undefined>();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>();
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'documents'>('overview');
  const [taxReport, setTaxReport] = useState<PropertyTaxReport | null>(null);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  const selectedProperty = useMemo(
    () => properties.find((item) => item.id === selectedPropertyId),
    [properties, selectedPropertyId],
  );

  const hasMoreRecords = records.length < recordsTotal && (!!nextCursor || records.length === 0);

  const refreshData = useCallback(async (nextPropertyId?: string) => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const propertyRows = await listProperties(organizationId);
      setProperties(propertyRows);
      const requestedPropertyId = nextPropertyId ?? selectedPropertyId ?? selectedPropertyIdProp;
      const fallbackPropertyId = propertyRows[0]?.id;
      const activePropertyId = propertyRows.some((item) => item.id === requestedPropertyId) ? requestedPropertyId : fallbackPropertyId;
      const activeProperty = propertyRows.find((item) => item.id === activePropertyId);
      setSelectedPropertyId(activePropertyId);
      onSelectedPropertyChange?.(activeProperty);

      if (activePropertyId) {
        const [response, report] = await Promise.all([
          listFinancialRecords(organizationId, activePropertyId, RECORDS_PAGE_SIZE),
          getPropertyTaxReport(activePropertyId, currentYear),
        ]);
        setRecords(response.items);
        setRecordsTotal(response.total);
        setNextCursor(response.next_cursor || undefined);
        setTaxReport(report);
      } else {
        setRecords([]);
        setRecordsTotal(0);
        setNextCursor(undefined);
        setTaxReport(null);
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load property records.');
    } finally {
      setLoading(false);
    }
  }, [onSelectedPropertyChange, organizationId, selectedPropertyIdProp, currentYear]);

  const handleLoadMore = useCallback(async () => {
    if (!organizationId || !selectedPropertyId || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const response = await listFinancialRecords(organizationId, selectedPropertyId, RECORDS_PAGE_SIZE, nextCursor);
      setRecords((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const appended = response.items.filter((item) => !seen.has(item.id));
        return [...prev, ...appended];
      });
      setRecordsTotal(response.total);
      setNextCursor(response.next_cursor || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more records.');
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, organizationId, selectedPropertyId, loadingMore]);

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

        {/* Property Info Card */}
        {selectedProperty && (
          <View style={styles.propertyInfoCard}>
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
        {loading && <ActivityIndicator style={{ marginTop: 12 }} color="#3b82f6" />}

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
                    backgroundGradientFrom: '#111827',
                    backgroundGradientTo: '#111827',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                    labelColor: () => '#64748b',
                    barPercentage: 0.6,
                    propsForBackgroundLines: { stroke: 'rgba(55,65,81,0.3)' },
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
                  <View style={[styles.quickButtonCircle, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                    <Text style={styles.quickButtonEmoji}>🏠</Text>
                  </View>
                  <Text style={styles.quickButtonLabel}>Rent</Text>
                </Pressable>
                <Pressable style={styles.quickButton} onPress={() => onOpenRecordForm({ draft: { type: 'expense' }, property: selectedProperty })}>
                  <View style={[styles.quickButtonCircle, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                    <Image source={expenseIcon} style={styles.quickButtonIcon} resizeMode="contain" />
                  </View>
                  <Text style={styles.quickButtonLabel}>Expense</Text>
                </Pressable>
                <Pressable style={styles.quickButton} onPress={() => onOpenRecordForm({ draft: { type: 'improvement', category_code: 'improvement' }, property: selectedProperty })}>
                  <View style={[styles.quickButtonCircle, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
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
                    <Text style={[styles.recordAmount, { color: record.type === 'income' ? '#22c55e' : '#ef4444' }]}>
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
            <Text style={styles.cardTitle}>This Year Records ({records.length} of {recordsTotal})</Text>
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
                  <Text style={[styles.recordAmount, { color: record.type === 'income' ? '#22c55e' : '#ef4444' }]}>
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
            {hasMoreRecords && (
              <Pressable style={styles.loadMoreButton} onPress={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text style={styles.loadMoreText}>Load more records</Text>}
              </Pressable>
            )}
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
            <ActivityIndicator size="small" color="#fff" />
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
  container: { flex: 1, backgroundColor: '#0a0e1a' },
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  headerTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDots: { color: '#f1f5f9', fontSize: 16, fontWeight: '800' },
  orgPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  orgPillIcon: { fontSize: 14, marginRight: 6 },
  orgPillText: { color: '#f1f5f9', fontSize: 13, fontWeight: '600' },
  orgPillCaret: { color: '#64748b', fontSize: 14, marginLeft: 6 },
  orgDropdownMenu: {
    marginHorizontal: 60,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  orgDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  orgDropdownItemActive: { backgroundColor: 'rgba(59,130,246,0.15)' },
  orgDropdownItemText: { color: '#f1f5f9', fontSize: 14, fontWeight: '600' },
  orgDropdownItemTextActive: { color: '#3b82f6' },
  propertyInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: 'rgba(17,24,39,0.8)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(55,65,81,0.5)',
  },
  propertyImage: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#1e293b',
  },
  propertyInfoText: { flex: 1, marginLeft: 12 },
  propertyInfoName: { color: '#f1f5f9', fontSize: 18, fontWeight: '800' },
  propertyInfoMeta: { color: '#64748b', fontSize: 13, fontWeight: '600', marginTop: 3 },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonIcon: { width: 20, height: 20 },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(55,65,81,0.3)',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabText: { color: '#64748b', fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: '#3b82f6' },
  card: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: 'rgba(17,24,39,0.8)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(55,65,81,0.5)',
  },
  cardTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '800' },
  cashFlowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cashFlowLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  cashFlowValue: { color: '#f1f5f9', fontSize: 28, fontWeight: '900', marginTop: 4 },
  voiceCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(139,92,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(139,92,246,0.4)',
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
    backgroundColor: 'rgba(17,24,39,0.8)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(55,65,81,0.5)',
  },
  metricLabel: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  metricValueGreen: { color: '#22c55e', fontSize: 16, fontWeight: '800', marginTop: 4 },
  metricValueRed: { color: '#ef4444', fontSize: 16, fontWeight: '800', marginTop: 4 },
  metricValueBlue: { color: '#3b82f6', fontSize: 16, fontWeight: '800', marginTop: 4 },
  recordsCountWrap: { flexDirection: 'row', alignItems: 'center' },
  quickRecordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  addTransactionLink: { color: '#3b82f6', fontSize: 13, fontWeight: '700' },
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
  quickButtonLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(55,65,81,0.3)',
  },
  recordInfo: { flex: 1, paddingRight: 12 },
  recordDate: { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },
  recordMeta: { color: '#64748b', fontSize: 12, marginTop: 3 },
  recordRight: { alignItems: 'flex-end' },
  recordAmount: { fontSize: 14, fontWeight: '800' },
  recordChevron: { color: '#64748b', fontSize: 20, marginTop: 2 },
  recordActionsRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  editLink: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },
  deleteLink: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
  helper: { color: '#64748b', fontSize: 13, lineHeight: 20, marginTop: 8 },
  error: { color: '#ef4444', marginHorizontal: 20, marginTop: 12, fontSize: 13, fontWeight: '700' },
  loadMoreButton: {
    marginTop: 14,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loadMoreText: { color: '#3b82f6', fontWeight: '800', fontSize: 13 },
  micFab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  micFabActive: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  micFabIcon: {
    width: 30,
    height: 30,
    tintColor: '#fff',
  },
  micFabPulse: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: 'rgba(239,68,68,0.5)',
  },
  recordMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  categoryBadge: {
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryBadgeText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '700',
  },
});
