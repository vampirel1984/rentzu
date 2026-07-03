// Modified by AI on 07/03/2026. Edit #1.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';

import { getPortfolioSummary, getPropertyTaxReport, listProperties, Property, PropertyPortfolioSummary, PropertyTaxReport } from '../services/properties';
import { Organization } from '../services/organizations';
import { downloadScheduleEPdf, downloadPropertyExpensePdf } from '../services/reports';
import { colors } from '../theme/tokens';

const taxIcon = require('../../assets/logo_12.png');

type Props = {
  organizationId?: string;
  organizations?: Organization[];
  selectedPropertyId?: string;
  refreshKey?: number;
  onSelectProperty: (propertyId: string) => void;
  onSelectOrganization?: (orgId: string) => void;
};

type TaxLine = {
  key: string;
  label: string;
  amount: number;
  kind: 'income' | 'expense' | 'neutral';
  section: 'main' | 'improvement' | 'detail';
  icon?: string;
};

const TAX_CATEGORY_GROUPS: { key: string; label: string; keys: string[]; kind: 'income' | 'expense'; icon: string }[] = [
  { key: 'rent', label: 'Rent', keys: ['rent', 'rental_income'], kind: 'income', icon: '🏠' },
  { key: 'additional_income', label: 'Additional Income', keys: ['additional_income', 'other_income', 'income', 'fee', 'fees', 'late_fee', 'late_fees', 'pet_fee', 'pet_fees'], kind: 'income', icon: '💰' },
  { key: 'legal', label: 'Legal & Professional', keys: ['legal', 'professional', 'accounting', 'bookkeeping'], kind: 'expense', icon: '💼' },
  { key: 'utility', label: 'Utilities', keys: ['water', 'utility', 'utilities', 'electric', 'gas', 'trash', 'internet'], kind: 'expense', icon: '⚡' },
  { key: 'cleaning', label: 'Cleaning', keys: ['cleaning', 'turnover'], kind: 'expense', icon: '🧹' },
  { key: 'management', label: 'Management', keys: ['management', 'property_management'], kind: 'expense', icon: '👔' },
  { key: 'maintenance', label: 'Maintenance & Repairs', keys: ['maintenance', 'repair', 'repairs'], kind: 'expense', icon: '🔧' },
  { key: 'travel', label: 'Travel', keys: ['travel', 'mileage'], kind: 'expense', icon: '✈️' },
  { key: 'tax', label: 'Taxes', keys: ['tax', 'property_tax', 'property_taxes', 'taxes'], kind: 'expense', icon: '🏛️' },
  { key: 'other', label: 'Other Expenses', keys: ['commission', 'interest', 'other', 'insurance', 'hoa', 'condo', 'association', 'uncategorized'], kind: 'expense', icon: '📦' },
];

const IMPROVEMENT_KEYS = ['improvement', 'improvements', 'capital_improvement', 'capital_improvements'];
const INCOME_DETAIL_KEYS = ['rent', 'rental_income', 'additional_income', 'other_income', 'income', 'fee', 'fees', 'late_fee', 'late_fees', 'pet_fee', 'pet_fees'];

function normalizeCategory(value?: string) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function buildTaxLines(report: PropertyTaxReport | null): TaxLine[] {
  if (!report) return [];
  const totals = new Map<string, number>();
  for (const item of report.category_totals || []) {
    const key = normalizeCategory(item.category_code);
    totals.set(key, (totals.get(key) || 0) + Number(item.amount || '0'));
  }
  const usedKeys = new Set<string>();
  const lines: TaxLine[] = [];
  for (const group of TAX_CATEGORY_GROUPS) {
    const amount = group.keys.reduce((sum, key) => sum + (totals.get(key) || 0), 0);
    group.keys.forEach((key) => { if (totals.get(key)) usedKeys.add(key); });
    if (amount > 0) {
      lines.push({ key: group.key, label: group.label, amount, kind: group.kind, section: 'main', icon: group.icon });
    }
  }
  const improvementAmount = IMPROVEMENT_KEYS.reduce((sum, key) => sum + (totals.get(key) || 0), 0);
  if (improvementAmount > 0) {
    lines.push({ key: 'improvement', label: 'Improvement', amount: improvementAmount, kind: 'expense', section: 'improvement' });
    IMPROVEMENT_KEYS.forEach((key) => { if (totals.get(key)) usedKeys.add(key); });
  }
  return lines;
}

export default function TaxReadyScreen({ organizationId, organizations, selectedPropertyId, refreshKey, onSelectProperty, onSelectOrganization }: Props) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [portfolio, setPortfolio] = useState<PropertyPortfolioSummary | null>(null);
  const [reportsByProperty, setReportsByProperty] = useState<Record<string, PropertyTaxReport>>({});
  const [activePropertyTab, setActivePropertyTab] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const refreshData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [propertyRows, portfolioSummary] = await Promise.all([
        listProperties(organizationId),
        getPortfolioSummary(organizationId, selectedYear),
      ]);
      setProperties(propertyRows);
      setPortfolio(portfolioSummary);
      const allReports = await Promise.all(
        propertyRows.map(async (property) => ({
          propertyId: property.id,
          report: await getPropertyTaxReport(property.id, selectedYear),
        })),
      );
      const nextReports = allReports.reduce<Record<string, PropertyTaxReport>>((acc, item) => {
        acc[item.propertyId] = item.report;
        return acc;
      }, {});
      setReportsByProperty(nextReports);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tax data.');
    } finally {
      setLoading(false);
    }
  }, [organizationId, selectedYear]);

  useEffect(() => { refreshData(); }, [refreshData, refreshKey]);

  const formatMoney = (value?: string | number | null) => {
    const amount = Number(value || 0);
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  // Compute deduction summary across active scope
  const deductionLines = useMemo(() => {
    if (activePropertyTab === 'all') {
      const combined = new Map<string, { amount: number; icon: string }>();
      Object.values(reportsByProperty).forEach((report) => {
        buildTaxLines(report).filter((l) => l.section === 'main').forEach((line) => {
          const existing = combined.get(line.label);
          combined.set(line.label, {
            amount: (existing?.amount || 0) + line.amount,
            icon: line.icon || existing?.icon || '📦',
          });
        });
      });
      return Array.from(combined.entries()).map(([label, data]) => ({
        label,
        amount: data.amount,
        icon: data.icon,
      }));
    }
    const report = reportsByProperty[activePropertyTab];
    if (!report) return [];
    return buildTaxLines(report).filter((l) => l.section === 'main').map((l) => ({
      label: l.label,
      amount: l.amount,
      icon: l.icon || '📦',
    }));
  }, [activePropertyTab, reportsByProperty]);

  const totalDeductions = useMemo(() => deductionLines.reduce((s, l) => s + l.amount, 0), [deductionLines]);
  const estimatedTaxImpact = useMemo(() => {
    const net = Number(portfolio?.net_total || 0);
    return net < 0 ? net * 0.25 : -totalDeductions * 0.25;
  }, [portfolio, totalDeductions]);

  const sharePdf = useCallback(async (uri: string, title: string) => {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: title,
        UTI: 'com.adobe.pdf',
      });
      return;
    }
    Alert.alert('PDF ready', `Saved to:\n${uri}`);
  }, []);

  const handleDownloadScheduleE = async () => {
    if (!organizationId) return;
    try {
      setDownloadingPdf('scheduleE');
      const uri = await downloadScheduleEPdf(organizationId, selectedYear);
      await sharePdf(uri, 'Open or share Schedule E PDF');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not download PDF');
    } finally {
      setDownloadingPdf(null);
    }
  };

  const handleDownloadPropertyExpense = async () => {
    if (!organizationId) return;
    try {
      setDownloadingPdf('propertyExpense');
      const propId = activePropertyTab !== 'all' ? activePropertyTab : undefined;
      const uri = await downloadPropertyExpensePdf(organizationId, selectedYear, propId);
      await sharePdf(uri, 'Open or share Property Expense PDF');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not download PDF');
    } finally {
      setDownloadingPdf(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 36 }} />
          <Text style={styles.headerTitle}>Tax Ready</Text>
          <Pressable style={styles.infoButton}>
            <Text style={styles.infoIcon}>ⓘ</Text>
          </Pressable>
        </View>

        {/* Org + Year Dropdowns */}
        <View style={styles.dropdownRow}>
          <Pressable style={styles.dropdownPill} onPress={() => { setOrgDropdownOpen(!orgDropdownOpen); setYearDropdownOpen(false); }}>
            <Text style={styles.dropdownPillIcon}>🏢</Text>
            <Text style={styles.dropdownPillText}>{organizations?.find(o => o.id === organizationId)?.name || 'Organization'}</Text>
            <Text style={styles.dropdownPillCaret}>▾</Text>
          </Pressable>
          <Pressable style={styles.dropdownPill} onPress={() => { setYearDropdownOpen(!yearDropdownOpen); setOrgDropdownOpen(false); }}>
            <Text style={styles.dropdownPillText}>{selectedYear} Tax Year</Text>
            <Text style={styles.dropdownPillCaret}>▾</Text>
          </Pressable>
        </View>

        {orgDropdownOpen && organizations && organizations.length > 0 && (
          <View style={styles.dropdownMenu}>
            {organizations.map((org) => (
              <Pressable key={org.id} style={[styles.dropdownItem, org.id === organizationId && styles.dropdownItemActive]}
                onPress={() => { onSelectOrganization?.(org.id); setOrgDropdownOpen(false); }}>
                <Text style={[styles.dropdownItemText, org.id === organizationId && styles.dropdownItemTextActive]}>{org.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {yearDropdownOpen && (
          <View style={styles.dropdownMenu}>
            {[currentYear, currentYear - 1, currentYear - 2].map((year) => (
              <Pressable key={year} style={[styles.dropdownItem, year === selectedYear && styles.dropdownItemActive]}
                onPress={() => { setSelectedYear(year); setYearDropdownOpen(false); }}>
                <Text style={[styles.dropdownItemText, year === selectedYear && styles.dropdownItemTextActive]}>{year}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Property Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.propertyTabs} contentContainerStyle={styles.propertyTabsContent}>
          <Pressable style={[styles.propertyTab, activePropertyTab === 'all' && styles.propertyTabActive]} onPress={() => setActivePropertyTab('all')}>
            <Text style={[styles.propertyTabText, activePropertyTab === 'all' && styles.propertyTabTextActive]}>All Properties Summary</Text>
          </Pressable>
          {properties.map((property) => (
            <Pressable key={property.id} style={[styles.propertyTab, activePropertyTab === property.id && styles.propertyTabActive]}
              onPress={() => { setActivePropertyTab(property.id); onSelectProperty(property.id); }}>
              <Text style={[styles.propertyTabText, activePropertyTab === property.id && styles.propertyTabTextActive]}>{property.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {!!error && <Text style={styles.error}>{error}</Text>}
        {loading && <ActivityIndicator style={{ marginTop: 12 }} color={colors.accent} />}

        {/* Estimated Tax Impact */}
        <View style={styles.taxImpactCard}>
          <View style={styles.taxImpactLeft}>
            <Text style={styles.taxImpactLabel}>Estimated tax impact</Text>
            <Text style={styles.taxImpactValue}>{formatMoney(estimatedTaxImpact)}</Text>
            <Text style={styles.taxImpactDeductionsLabel}>Total deductions</Text>
            <Text style={styles.taxImpactDeductionsValue}>{formatMoney(totalDeductions)}</Text>
          </View>
          <Image source={taxIcon} style={styles.taxImpactImage} resizeMode="contain" />
        </View>

        {/* Deduction Summary */}
        <View style={styles.card}>
          <View style={styles.deductionHeader}>
            <View>
              <Text style={styles.cardTitle}>Deduction summary</Text>
              <Text style={styles.deductionScope}>
                {activePropertyTab === 'all' ? 'All Properties' : properties.find(p => p.id === activePropertyTab)?.name || 'Property'}
              </Text>
            </View>
            <Text style={styles.yearBadge}>{selectedYear} YTD</Text>
          </View>

          {deductionLines.length === 0 && <Text style={styles.helper}>No deductions recorded yet.</Text>}
          {deductionLines.map((line) => (
            <View key={line.label} style={styles.deductionRow}>
              <Text style={styles.deductionIcon}>{line.icon}</Text>
              <Text style={styles.deductionLabel}>{line.label}</Text>
              <Text style={styles.deductionAmount}>{formatMoney(line.amount)}</Text>
            </View>
          ))}

          {deductionLines.length > 0 && (
            <>
              <View style={styles.deductionDivider} />
              <View style={styles.deductionRow}>
                <Text style={styles.deductionIcon}>{'  '}</Text>
                <Text style={styles.totalLabel}>Total Deductions</Text>
                <Text style={styles.totalAmount}>{formatMoney(totalDeductions)}</Text>
              </View>
              <View style={styles.deductionRow}>
                <Text style={styles.deductionIcon}>{'  '}</Text>
                <Text style={styles.totalLabel}>Net Tax Impact</Text>
                <Text style={styles.netTaxAmount}>{formatMoney(estimatedTaxImpact)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Reports */}
        <View style={styles.card}>
          <View style={styles.reportsHeader}>
            <Text style={styles.cardTitle}>Reports</Text>
            <Pressable><Text style={styles.viewAllLink}>View all</Text></Pressable>
          </View>

          <Pressable style={styles.reportRow} onPress={handleDownloadScheduleE} disabled={!!downloadingPdf}>
            <View style={styles.reportIconWrap}>
              <Text style={styles.reportIcon}>📄</Text>
            </View>
            <View style={styles.reportInfo}>
              <Text style={styles.reportName}>Schedule E Summary</Text>
            </View>
            <View style={styles.pdfBadge}><Text style={styles.pdfBadgeText}>PDF</Text></View>
            <Text style={styles.downloadIcon}>
              {downloadingPdf === 'scheduleE' ? '⏳' : '⬇'}
            </Text>
          </Pressable>

          <Pressable style={styles.reportRow} onPress={handleDownloadPropertyExpense} disabled={!!downloadingPdf}>
            <View style={styles.reportIconWrap}>
              <Text style={styles.reportIcon}>📄</Text>
            </View>
            <View style={styles.reportInfo}>
              <Text style={styles.reportName}>Property Expense Summary</Text>
            </View>
            <View style={styles.pdfBadge}><Text style={styles.pdfBadgeText}>PDF</Text></View>
            <Text style={styles.downloadIcon}>
              {downloadingPdf === 'propertyExpense' ? '⏳' : '⬇'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 30 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', flex: 1, textAlign: 'center' },
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIcon: { color: colors.textSecondary, fontSize: 18 },
  dropdownRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 10,
  },
  dropdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dropdownPillIcon: { fontSize: 14, marginRight: 6 },
  dropdownPillText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  dropdownPillCaret: { color: colors.textMuted, fontSize: 14, marginLeft: 6 },
  dropdownMenu: {
    marginHorizontal: 20,
    backgroundColor: colors.menu,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  dropdownItemActive: { backgroundColor: colors.accentSoft },
  dropdownItemText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  dropdownItemTextActive: { color: colors.accent },
  propertyTabs: {
    marginTop: 16,
    flexGrow: 0,
  },
  propertyTabsContent: {
    paddingHorizontal: 20,
    gap: 4,
  },
  propertyTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  propertyTabActive: {
    borderBottomColor: colors.accent,
  },
  propertyTabText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  propertyTabTextActive: {
    color: colors.accent,
  },
  taxImpactCard: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  taxImpactLeft: { flex: 1 },
  taxImpactLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  taxImpactValue: { color: colors.expense, fontSize: 28, fontWeight: '900', marginTop: 6 },
  taxImpactDeductionsLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 12 },
  taxImpactDeductionsValue: { color: colors.income, fontSize: 18, fontWeight: '800', marginTop: 2 },
  taxImpactImage: { width: 90, height: 90 },
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
  deductionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  deductionScope: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 2 },
  yearBadge: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  deductionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  deductionIcon: { fontSize: 16, width: 28 },
  deductionLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  deductionAmount: { color: colors.income, fontSize: 14, fontWeight: '800' },
  deductionDivider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: 8,
  },
  totalLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '800', flex: 1 },
  totalAmount: { color: colors.income, fontSize: 15, fontWeight: '900' },
  netTaxAmount: { color: colors.expense, fontSize: 15, fontWeight: '900' },
  reportsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  viewAllLink: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerSubtle,
  },
  reportIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reportIcon: { fontSize: 18 },
  reportInfo: { flex: 1 },
  reportName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  pdfBadge: {
    backgroundColor: colors.expenseSoft,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 10,
  },
  pdfBadgeText: { color: colors.expense, fontSize: 11, fontWeight: '800' },
  downloadIcon: { color: colors.textMuted, fontSize: 18 },
  helper: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 4 },
  error: { color: colors.expense, marginHorizontal: 20, marginTop: 12, fontSize: 13, fontWeight: '700' },
});
