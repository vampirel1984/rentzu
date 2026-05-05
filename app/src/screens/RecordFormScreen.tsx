import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { createFinancialRecord, FinancialRecord, FinancialRecordPayload, updateFinancialRecord } from '../services/financialRecords';
import { Property } from '../services/properties';

const TYPE_OPTIONS = ['expense', 'income'] as const;
const INCOME_CATEGORY_OPTIONS = [
  { value: 'rent', label: 'Rent' },
  { value: 'additional_income', label: 'Additional Income' },
] as const;

const EXPENSE_CATEGORY_OPTIONS = [
  { value: 'legal', label: 'Legal' },
  { value: 'utility', label: 'Utility' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'management', label: 'Management' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'repair', label: 'Repair' },
  { value: 'travel', label: 'Travel' },
  { value: 'commission', label: 'Commission' },
  { value: 'interest', label: 'Interest' },
  { value: 'other', label: 'Other' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'tax', label: 'Tax' },
] as const;

type RecordFormState = {
  type: string;
  amount: string;
  record_date: string;
  description: string;
  counterparty: string;
  category_code: string;
  sub_type: string;
  notes: string;
};

type Props = {
  organizationId?: string;
  selectedProperty?: Property;
  selectedUnitId?: string;
  userId?: string;
  initialRecord?: FinancialRecord;
  initialDraft?: Partial<RecordFormState>;
  onBack: () => void;
  onSaved: (record: FinancialRecord) => void;
};

const emptyRecordForm = (): RecordFormState => ({
  type: 'expense',
  amount: '',
  record_date: new Date().toISOString().slice(0, 10),
  description: '',
  counterparty: '',
  category_code: '',
  sub_type: '',
  notes: '',
});

export default function RecordFormScreen({ organizationId, selectedProperty, selectedUnitId: selectedUnitIdProp, userId, initialRecord, initialDraft, onBack, onSaved }: Props) {
  const initialForm = useMemo<RecordFormState>(() => {
    const base = initialRecord
      ? {
          type: initialRecord.type,
          amount: String(initialRecord.amount),
          record_date: initialRecord.record_date,
          description: initialRecord.description,
          counterparty: initialRecord.counterparty ?? '',
          category_code: initialRecord.category_code ?? '',
          sub_type: initialRecord.sub_type ?? '',
          notes: initialRecord.notes ?? '',
        }
      : emptyRecordForm();

    return {
      ...base,
      type: initialDraft?.type ?? base.type,
      amount: initialDraft?.amount ?? base.amount,
      record_date: initialDraft?.record_date ?? base.record_date,
      description: initialDraft?.description ?? base.description,
      counterparty: initialDraft?.counterparty ?? base.counterparty,
      category_code: initialDraft?.category_code ?? base.category_code,
      sub_type: initialDraft?.sub_type ?? base.sub_type,
      notes: initialDraft?.notes ?? base.notes,
    };
  }, [initialDraft, initialRecord]);

  const [recordForm, setRecordForm] = useState<RecordFormState>(initialForm);
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(initialRecord?.unit_id || selectedUnitIdProp);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const submitLock = useRef(false);
  const isEditing = !!initialRecord;

  const activeUnits = useMemo(
    () => selectedProperty?.units?.filter((unit) => unit.is_active !== false) || [],
    [selectedProperty],
  );
  const displayUnits = useMemo(
    () => activeUnits.length
      ? activeUnits
      : Array.from({ length: Math.max(0, selectedProperty?.total_units || 0) }, (_, index) => ({
          id: `fallback-unit-${index + 1}`,
          unit_code: `Unit ${index + 1}`,
          is_active: true,
        })),
    [activeUnits, selectedProperty?.total_units],
  );

  const categoryOptions = useMemo(() => {
    if (recordForm.type === 'income') return INCOME_CATEGORY_OPTIONS;
    if (recordForm.type === 'expense') return EXPENSE_CATEGORY_OPTIONS;
    return [];
  }, [recordForm.type]);

  const selectedCategoryLabel = useMemo(() => {
    if (recordForm.type === 'improvement') return 'Improvement';
    return categoryOptions.find((option) => option.value === recordForm.category_code)?.label || '';
  }, [categoryOptions, recordForm.category_code, recordForm.type]);

  const parsedDate = useMemo(() => {
    const parts = recordForm.record_date.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }, [recordForm.record_date]);

  useEffect(() => {
    setShowCategoryDropdown(false);
    if (recordForm.type === 'improvement') {
      setRecordForm((prev) => (prev.category_code === 'improvement' ? prev : { ...prev, category_code: 'improvement' }));
      return;
    }
    const isAllowedValue = categoryOptions.some((option) => option.value === recordForm.category_code);
    if (recordForm.category_code && !isAllowedValue) {
      setRecordForm((prev) => ({ ...prev, category_code: '' }));
    }
  }, [categoryOptions, recordForm.category_code, recordForm.type]);

  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().slice(0, 10);
      setRecordForm((prev) => ({ ...prev, record_date: dateStr }));
    }
    setShowDatePicker(false);
  };

  const handleSave = async () => {
    if (submitLock.current || saving) return;
    if (!organizationId || !selectedProperty?.id) { setError('Select a property first.'); return; }
    if (!recordForm.amount || !recordForm.description || !recordForm.record_date) { setError('Amount, date, and description are required.'); return; }

    const payload: FinancialRecordPayload = {
      organization_id: organizationId,
      property_id: selectedProperty.id,
      unit_id: selectedUnitId || undefined,
      type: recordForm.type,
      amount: Number(recordForm.amount),
      currency: 'USD',
      record_date: recordForm.record_date,
      description: recordForm.description,
      counterparty: recordForm.counterparty || undefined,
      category_code: recordForm.category_code || undefined,
      sub_type: recordForm.sub_type || undefined,
      notes: recordForm.notes || undefined,
      source: 'manual',
      created_by: userId,
    };

    try {
      submitLock.current = true;
      setSaving(true);
      setError('');
      const saved = initialRecord
        ? await updateFinancialRecord(initialRecord.id, payload)
        : await createFinancialRecord(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${isEditing ? 'save' : 'create'} record.`);
    } finally {
      setSaving(false);
      setTimeout(() => { submitLock.current = false; }, 350);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Transaction' : 'New Transaction'}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.helper}>
            {selectedProperty ? `Property: ${selectedProperty.name}` : 'Choose a property before saving this record.'}
          </Text>

          {!!selectedProperty && (
            <>
              <Text style={styles.fieldLabel}>Entry scope</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionRow}>
                <Pressable
                  onPress={() => setSelectedUnitId(undefined)}
                  style={[styles.optionChip, !selectedUnitId && styles.optionChipActive]}>
                  <Text style={[styles.optionChipText, !selectedUnitId && styles.optionChipTextActive]}>Property</Text>
                </Pressable>
                {displayUnits.map((unit) => {
                  const active = selectedUnitId === unit.id;
                  return (
                    <Pressable key={unit.id}
                      onPress={() => setSelectedUnitId((current) => (current === unit.id ? undefined : unit.id))}
                      style={[styles.optionChip, active && styles.optionChipActive]}>
                      <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{unit.unit_code}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={styles.scopeHelper}>
                {selectedUnitId ? `Saved to ${displayUnits.find((u) => u.id === selectedUnitId)?.unit_code || 'selected unit'}.` : 'Saved at whole-property level.'}
              </Text>
            </>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.fieldLabel}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionRow}>
            {TYPE_OPTIONS.map((option) => {
              const active = recordForm.type === option;
              return (
                <Pressable key={option}
                  onPress={() => setRecordForm((prev) => ({ ...prev, type: option }))}
                  style={[styles.optionChip, active && styles.optionChipActive]}>
                  <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{option}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>Amount</Text>
              <TextInput style={styles.input} value={recordForm.amount}
                onChangeText={(v) => setRecordForm((p) => ({ ...p, amount: v }))}
                keyboardType="decimal-pad" placeholder="1250.00" placeholderTextColor="#4b5563" />
            </View>
            <View style={[styles.half, styles.leftSpacing]}>
              <Text style={styles.fieldLabel}>Date</Text>
              <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateButtonText}>{recordForm.record_date || 'Pick a date'}</Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker value={parsedDate} mode="date" display="default" onChange={handleDateChange} />
              )}
            </View>
          </View>

          {recordForm.type !== 'improvement' && (
            <>
              <Text style={styles.fieldLabel}>Category</Text>
              <Pressable style={styles.dropdownButton} onPress={() => setShowCategoryDropdown((v) => !v)}>
                <Text style={[styles.dropdownButtonText, !selectedCategoryLabel && styles.dropdownPlaceholder]}>
                  {selectedCategoryLabel || (recordForm.type === 'income' ? 'Select income category' : 'Select expense category')}
                </Text>
                <Text style={styles.dropdownCaret}>{showCategoryDropdown ? '▲' : '▼'}</Text>
              </Pressable>
              {showCategoryDropdown && (
                <View style={styles.dropdownMenu}>
                  {categoryOptions.map((option) => {
                    const active = recordForm.category_code === option.value;
                    return (
                      <Pressable key={option.value}
                        onPress={() => { setRecordForm((p) => ({ ...p, category_code: option.value })); setShowCategoryDropdown(false); }}
                        style={[styles.dropdownItem, active && styles.dropdownItemActive]}>
                        <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={styles.input} value={recordForm.description}
            onChangeText={(v) => setRecordForm((p) => ({ ...p, description: v }))}
            placeholder="Roof repair" placeholderTextColor="#4b5563" />

          <Text style={styles.fieldLabel}>Counterparty</Text>
          <TextInput style={styles.input} value={recordForm.counterparty}
            onChangeText={(v) => setRecordForm((p) => ({ ...p, counterparty: v }))}
            placeholder="Vendor / tenant" placeholderTextColor="#4b5563" />

          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput style={[styles.input, styles.textArea]} value={recordForm.notes}
            onChangeText={(v) => setRecordForm((p) => ({ ...p, notes: v }))}
            multiline placeholder="Optional notes" placeholderTextColor="#4b5563" />

          <Pressable style={[styles.primaryButton, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : isEditing ? 'Save transaction' : 'Create transaction'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingTop: 8,
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
  headerTitle: { color: '#f1f5f9', fontSize: 20, fontWeight: '800' },
  card: {
    backgroundColor: 'rgba(17,24,39,0.8)',
    borderRadius: 24,
    padding: 18,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(55,65,81,0.5)',
  },
  helper: { color: '#94a3b8', fontSize: 13, lineHeight: 20, marginBottom: 4 },
  fieldLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  half: { flex: 1 },
  leftSpacing: { marginLeft: 12 },
  optionRow: { marginTop: 6, flexGrow: 0 },
  scopeHelper: { color: '#3b82f6', fontSize: 12, fontWeight: '700', marginTop: 8, lineHeight: 18 },
  optionChip: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
  },
  optionChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  optionChipText: { color: '#3b82f6', fontWeight: '700', fontSize: 12 },
  optionChipTextActive: { color: '#fff' },
  primaryButton: {
    marginTop: 22,
    backgroundColor: '#3b82f6',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  buttonDisabled: { opacity: 0.6 },
  error: { color: '#ef4444', marginTop: 8, marginBottom: 4, fontSize: 13, fontWeight: '700' },
  dateButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dateButtonText: { fontSize: 14, color: '#f1f5f9', fontWeight: '600' },
  dropdownButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dropdownButtonText: { fontSize: 14, color: '#f1f5f9', fontWeight: '600', flex: 1 },
  dropdownPlaceholder: { color: '#4b5563' },
  dropdownCaret: { color: '#64748b', fontSize: 12, fontWeight: '800', marginLeft: 12 },
  dropdownMenu: {
    marginTop: 8,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dropdownItem: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  dropdownItemActive: { backgroundColor: 'rgba(59,130,246,0.15)' },
  dropdownItemText: { color: '#f1f5f9', fontSize: 14, fontWeight: '600' },
  dropdownItemTextActive: { color: '#3b82f6', fontWeight: '800' },
});
