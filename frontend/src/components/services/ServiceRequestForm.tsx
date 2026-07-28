import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, FlatList, Pressable,
} from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import type { ServiceField } from '../../constants/services';
import { colors, radii, spacing } from '../../constants/theme';

type Props = {
  fields: ServiceField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  errors?: Record<string, string>;
};

export function ServiceRequestForm({ fields, values, onChange, errors = {} }: Props) {
  const [openSelect, setOpenSelect] = useState<ServiceField | null>(null);

  return (
    <View style={styles.wrap}>
      {fields.map((field) => {
        const err = errors[field.key];
        if (field.type === 'select') {
          const selected = field.options?.find((o) => o.value === values[field.key]);
          return (
            <View key={field.key} style={styles.field}>
              <Text style={styles.label}>
                {field.label}{field.required ? ' *' : ''}
              </Text>
              <TouchableOpacity
                style={[styles.input, styles.select, err && styles.inputError]}
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
              {field.label}{field.required ? ' *' : ''}
            </Text>
            <TextInput
              style={[styles.input, multiline && styles.textarea, err && styles.inputError]}
              value={values[field.key] || ''}
              onChangeText={(v) => onChange(field.key, v)}
              placeholder={field.placeholder || (field.type === 'date' ? 'JJ/MM/AAAA' : field.type === 'datetime' ? 'JJ/MM/AAAA HH:MM' : undefined)}
              placeholderTextColor={colors.textSecondary}
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
      })}

      <Modal visible={!!openSelect} transparent animationType="fade" onRequestClose={() => setOpenSelect(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpenSelect(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{openSelect?.label}</Text>
            <FlatList
              data={openSelect?.options || []}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => {
                const active = values[openSelect!.key] === item.value;
                return (
                  <TouchableOpacity
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => {
                      onChange(openSelect!.key, item.value);
                      setOpenSelect(null);
                    }}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{item.label}</Text>
                    {active ? <Check size={18} color={colors.primary} /> : null}
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
  wrap: { gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 48,
  },
  textarea: { minHeight: 100, paddingTop: 12 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { flex: 1, fontSize: 15, color: colors.text, marginRight: 8 },
  placeholder: { color: colors.textSecondary },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 24,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  optionActive: { backgroundColor: '#EFF6FF' },
  optionText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  optionTextActive: { color: colors.primary },
});
