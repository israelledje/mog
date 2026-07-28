import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, FlatList, Pressable,
} from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import type { ServiceField } from '../../constants/services';
import { colors, spacing, fonts } from '../../constants/theme';

type Props = {
  fields: ServiceField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  errors?: Record<string, string>;
  accentColor?: string;
};

const CONTACT_KEYS = new Set(['full_name', 'phone', 'email', 'nationality', 'passport']);
const NOTES_KEYS = new Set(['notes', 'needs', 'preferences', 'special_notes']);

type Section = { id: string; title: string; subtitle?: string; fields: ServiceField[] };

function groupFields(fields: ServiceField[]): Section[] {
  const contact: ServiceField[] = [];
  const details: ServiceField[] = [];
  const notes: ServiceField[] = [];
  for (const f of fields) {
    if (CONTACT_KEYS.has(f.key)) contact.push(f);
    else if (NOTES_KEYS.has(f.key) || f.type === 'textarea') notes.push(f);
    else details.push(f);
  }
  const sections: Section[] = [];
  if (contact.length) {
    sections.push({
      id: 'contact',
      title: 'Coordonnées',
      subtitle: 'Pour vous rappeler rapidement et en toute confidentialité.',
      fields: contact,
    });
  }
  if (details.length) {
    sections.push({
      id: 'details',
      title: 'Détails de la demande',
      subtitle: 'Informations utiles à la préparation de votre dossier.',
      fields: details,
    });
  }
  if (notes.length) {
    sections.push({
      id: 'notes',
      title: 'Informations complémentaires',
      subtitle: 'Précisions facultatives pour affiner notre réponse.',
      fields: notes,
    });
  }
  return sections;
}

export function ServiceRequestForm({ fields, values, onChange, errors = {}, accentColor = colors.primary }: Props) {
  const [openSelect, setOpenSelect] = useState<ServiceField | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const sections = useMemo(() => groupFields(fields), [fields]);

  const renderField = (field: ServiceField) => {
    const err = errors[field.key];
    const isFocused = focused === field.key;

    if (field.type === 'select') {
      const selected = field.options?.find((o) => o.value === values[field.key]);
      return (
        <View key={field.key} style={styles.field}>
          <Text style={styles.label}>
            {field.label}
            {field.required ? <Text style={styles.req}> *</Text> : null}
          </Text>
          <TouchableOpacity
            style={[
              styles.input,
              styles.select,
              isFocused && { borderColor: accentColor, backgroundColor: '#fff' },
              err && styles.inputError,
            ]}
            onPress={() => setOpenSelect(field)}
            activeOpacity={0.85}
          >
            <Text style={[styles.selectText, !selected && styles.placeholder]} numberOfLines={1}>
              {selected?.label || field.placeholder || 'Sélectionner…'}
            </Text>
            <ChevronDown size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          {err ? <Text style={styles.error}>{err}</Text> : null}
        </View>
      );
    }

    const multiline = field.type === 'textarea';
    return (
      <View key={field.key} style={styles.field}>
        <Text style={styles.label}>
          {field.label}
          {field.required ? <Text style={styles.req}> *</Text> : null}
        </Text>
        <TextInput
          style={[
            styles.input,
            multiline && styles.textarea,
            isFocused && { borderColor: accentColor, backgroundColor: '#fff' },
            err && styles.inputError,
          ]}
          value={values[field.key] || ''}
          onChangeText={(v) => onChange(field.key, v)}
          onFocus={() => setFocused(field.key)}
          onBlur={() => setFocused(null)}
          placeholder={
            field.placeholder
            || (field.type === 'date' ? 'JJ/MM/AAAA' : field.type === 'datetime' ? 'JJ/MM/AAAA HH:MM' : undefined)
          }
          placeholderTextColor="#9CA3AF"
          keyboardType={
            field.type === 'phone' ? 'phone-pad'
              : field.type === 'email' ? 'email-address'
                : field.type === 'number' ? 'numeric'
                  : 'default'
          }
          autoCapitalize={field.type === 'email' ? 'none' : 'sentences'}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
        {err ? <Text style={styles.error}>{err}</Text> : null}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      {sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: accentColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.subtitle ? <Text style={styles.sectionSub}>{section.subtitle}</Text> : null}
            </View>
          </View>
          <View style={styles.sectionBody}>
            {section.fields.map(renderField)}
          </View>
        </View>
      ))}

      <Modal visible={!!openSelect} transparent animationType="fade" onRequestClose={() => setOpenSelect(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpenSelect(null)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{openSelect?.label}</Text>
            <FlatList
              data={openSelect?.options || []}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => {
                const active = values[openSelect!.key] === item.value;
                return (
                  <TouchableOpacity
                    style={[styles.option, active && { backgroundColor: `${accentColor}12` }]}
                    onPress={() => {
                      onChange(openSelect!.key, item.value);
                      setOpenSelect(null);
                    }}
                  >
                    <Text style={[styles.optionText, active && { color: accentColor }]}>{item.label}</Text>
                    {active ? <Check size={18} color={accentColor} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function validateServiceForm(fields: ServiceField[], values: Record<string, string>) {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = (values[f.key] || '').trim();
    if (f.required && !v) {
      errors[f.key] = 'Champ obligatoire';
      continue;
    }
    if (f.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      errors[f.key] = 'Email invalide';
    }
    if (f.type === 'phone' && v && v.replace(/\D/g, '').length < 8) {
      errors[f.key] = 'Numéro invalide';
    }
  }
  return errors;
}

export function humanizePayload(fields: ServiceField[], values: Record<string, string>) {
  return fields
    .map((f) => {
      const raw = (values[f.key] || '').trim();
      if (!raw) return null;
      const label = f.options?.find((o) => o.value === raw)?.label || raw;
      return `${f.label}: ${label}`;
    })
    .filter(Boolean)
    .join('\n');
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF1',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FAFBFC',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F5',
  },
  sectionAccent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginTop: 2,
    minHeight: 28,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    fontFamily: fonts.heading,
    letterSpacing: 0.2,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  sectionBody: {
    padding: 16,
    gap: 16,
  },
  field: { gap: 7 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  req: { color: colors.danger, fontWeight: '800' },
  input: {
    backgroundColor: '#F5F7FA',
    borderWidth: 1.5,
    borderColor: '#E5E9EF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
    minHeight: 50,
  },
  textarea: { minHeight: 110, paddingTop: 13 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { flex: 1, fontSize: 15, color: colors.text, marginRight: 8 },
  placeholder: { color: '#9CA3AF' },
  inputError: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  error: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '62%',
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    color: colors.text,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  optionText: { fontSize: 15, color: colors.text, fontWeight: '600' },
});
