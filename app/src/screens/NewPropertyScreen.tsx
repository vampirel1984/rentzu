// Modified by AI on 07/03/2026. Edit #1.
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { createProperty, Property, updateProperty } from '../services/properties';
import { colors } from '../theme/tokens';

const PROPERTY_TYPE_OPTIONS = [
  { value: 'single_family', label: 'Single family' },
  { value: 'duplex', label: 'Duplex' },
  { value: 'triplex', label: 'Triplex' },
  { value: 'fourplex', label: 'Fourplex' },
  { value: 'multi_family', label: 'Multi family' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhome', label: 'Townhome' },
  { value: 'room_rental', label: 'Room rental' },
  { value: 'other', label: 'Other' },
] as const;

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL',
  'GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
  'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
] as const;

type Props = {
  organizationId?: string;
  initialProperty?: Property;
  onBack: () => void;
  onSaved: (property: Property) => void;
};

type PropertyFormState = {
  name: string;
  property_type: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  total_units: string;
  notes: string;
};

const emptyPropertyForm = (): PropertyFormState => ({
  name: '',
  property_type: 'single_family',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'US',
  total_units: '1',
  notes: '',
});

const defaultUnitsForPropertyType = (propertyType: string): string => {
  if (propertyType === 'duplex') return '2';
  if (propertyType === 'triplex') return '3';
  if (propertyType === 'fourplex') return '4';
  return '1';
};

export default function NewPropertyScreen({ organizationId, initialProperty, onBack, onSaved }: Props) {
  const initialForm = useMemo<PropertyFormState>(() => {
    if (!initialProperty) return emptyPropertyForm();
    return {
      name: initialProperty.name,
      property_type: initialProperty.property_type,
      address_line_1: initialProperty.address_line_1,
      address_line_2: initialProperty.address_line_2 ?? '',
      city: initialProperty.city ?? '',
      state: initialProperty.state ?? '',
      postal_code: initialProperty.postal_code ?? '',
      country: initialProperty.country ?? 'US',
      total_units: String(initialProperty.total_units ?? 1),
      notes: initialProperty.notes ?? '',
    };
  }, [initialProperty]);

  const [propertyForm, setPropertyForm] = useState<PropertyFormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitLock = useRef(false);
  const isEditing = !!initialProperty;

  const handleSaveProperty = async () => {
    if (submitLock.current || saving) return;
    if (!organizationId) { setError('No organization loaded.'); return; }
    if (!propertyForm.name || !propertyForm.address_line_1) { setError('Property name and address are required.'); return; }
    try {
      submitLock.current = true;
      setSaving(true);
      setError('');
      const payload = {
        organization_id: organizationId,
        name: propertyForm.name,
        property_type: propertyForm.property_type,
        address_line_1: propertyForm.address_line_1,
        address_line_2: propertyForm.address_line_2 || undefined,
        city: propertyForm.city || undefined,
        state: propertyForm.state || undefined,
        postal_code: propertyForm.postal_code || undefined,
        country: propertyForm.country || 'US',
        total_units: Number(propertyForm.total_units || '1'),
        is_active: true,
        notes: propertyForm.notes || undefined,
      };
      const saved = initialProperty
        ? await updateProperty(initialProperty.id, payload)
        : await createProperty(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${isEditing ? 'save' : 'create'} property.`);
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
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Property' : 'New Property'}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.helper}>{isEditing ? 'Edit the property details below.' : 'Create the property here, then return to the dashboard.'}</Text>
          {!!error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.fieldLabel}>Property name</Text>
          <TextInput style={styles.input} value={propertyForm.name} onChangeText={(v) => setPropertyForm((p) => ({ ...p, name: v }))} placeholder="Elm Street Duplex" placeholderTextColor={colors.textFaint} />

          <Text style={styles.fieldLabel}>Property type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {PROPERTY_TYPE_OPTIONS.map((option) => {
              const active = propertyForm.property_type === option.value;
              return (
                <Pressable key={option.value}
                  onPress={() => setPropertyForm((p) => ({ ...p, property_type: option.value, total_units: defaultUnitsForPropertyType(option.value) }))}
                  style={[styles.typeChip, active && styles.typeChipActive]}>
                  <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.fieldLabel}>Address</Text>
          <TextInput style={styles.input} value={propertyForm.address_line_1} onChangeText={(v) => setPropertyForm((p) => ({ ...p, address_line_1: v }))} placeholder="123 Main St" placeholderTextColor={colors.textFaint} />

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>City</Text>
              <TextInput style={styles.input} value={propertyForm.city} onChangeText={(v) => setPropertyForm((p) => ({ ...p, city: v }))} placeholder="Houston" placeholderTextColor={colors.textFaint} />
            </View>
            <View style={[styles.half, styles.leftSpacing]}>
              <Text style={styles.fieldLabel}>State</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stateRow}>
                {US_STATES.map((st) => {
                  const active = propertyForm.state === st;
                  return (
                    <Pressable key={st} onPress={() => setPropertyForm((p) => ({ ...p, state: st }))}
                      style={[styles.stateChip, active && styles.stateChipActive]}>
                      <Text style={[styles.stateChipText, active && styles.stateChipTextActive]}>{st}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>Postal code</Text>
              <TextInput style={styles.input} value={propertyForm.postal_code} onChangeText={(v) => setPropertyForm((p) => ({ ...p, postal_code: v }))} placeholder="77001" placeholderTextColor={colors.textFaint} />
            </View>
            <View style={[styles.half, styles.leftSpacing]}>
              <Text style={styles.fieldLabel}>Total units</Text>
              <TextInput style={styles.input} value={propertyForm.total_units} onChangeText={(v) => setPropertyForm((p) => ({ ...p, total_units: v }))} keyboardType="number-pad" placeholder="1" placeholderTextColor={colors.textFaint} />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput style={[styles.input, styles.textArea]} value={propertyForm.notes} onChangeText={(v) => setPropertyForm((p) => ({ ...p, notes: v }))} multiline placeholder="Tax notes, rehab details..." placeholderTextColor={colors.textFaint} />

          <Pressable style={[styles.primaryButton, saving && styles.buttonDisabled]} onPress={handleSaveProperty} disabled={saving}>
            <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : isEditing ? 'Save property' : 'Create property'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 18,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  helper: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  half: { flex: 1 },
  leftSpacing: { marginLeft: 12 },
  primaryButton: {
    marginTop: 22,
    backgroundColor: colors.accent,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.onAccent, fontWeight: '800', fontSize: 15 },
  buttonDisabled: { opacity: 0.6 },
  error: { color: colors.expense, marginTop: 8, marginBottom: 4, fontSize: 13, fontWeight: '700' },
  chipRow: { flexGrow: 0, marginBottom: 4 },
  typeChip: {
    backgroundColor: colors.accentChip,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  typeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  typeChipText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  typeChipTextActive: { color: colors.onAccent },
  stateRow: { flexGrow: 0 },
  stateChip: {
    backgroundColor: colors.accentChip,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  stateChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  stateChipText: { color: colors.accent, fontWeight: '700', fontSize: 12 },
  stateChipTextActive: { color: colors.onAccent },
});
