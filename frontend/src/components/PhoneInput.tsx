import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { COUNTRY_CODES, type CountryCode } from '../constants/countryCodes';
import { colors, radii, spacing } from '../constants/theme';

type Props = {
  dialCode: string;
  nationalNumber: string;
  onDialCodeChange: (dial: string) => void;
  onNationalNumberChange: (value: string) => void;
  placeholder?: string;
  testID?: string;
};

export default function PhoneInput({
  dialCode,
  nationalNumber,
  onDialCodeChange,
  onNationalNumberChange,
  placeholder,
  testID,
}: Props) {
  const [showCountries, setShowCountries] = useState(false);
  const selected = COUNTRY_CODES.find((c) => c.dial === dialCode) || COUNTRY_CODES[0];

  const pickCountry = (country: CountryCode) => {
    onDialCodeChange(country.dial);
    setShowCountries(false);
  };

  return (
    <View>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.countryBtn}
          onPress={() => setShowCountries((s) => !s)}
          activeOpacity={0.7}
          testID={testID ? `${testID}-country` : undefined}
        >
          <Text style={styles.countryText}>{selected.flag} {selected.dial}</Text>
          <ChevronDown size={14} color={colors.textSecondary} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={nationalNumber}
          onChangeText={(v) => onNationalNumberChange(v.replace(/[^\d\s]/g, ''))}
          keyboardType="phone-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          testID={testID}
        />
      </View>
      {showCountries && (
        <View style={styles.dropdown}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {COUNTRY_CODES.map((c) => (
              <TouchableOpacity
                key={`${c.code}-${c.dial}`}
                style={[styles.dropItem, c.dial === dialCode && styles.dropItemActive]}
                onPress={() => pickCountry(c)}
              >
                <Text style={styles.dropItemText}>{c.flag} {c.label} ({c.dial})</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    height: 50,
    minWidth: 108,
  },
  countryText: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    height: 50,
    fontSize: 15,
    color: colors.text,
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: radii.input,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dropItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  dropItemActive: { backgroundColor: colors.borderLight },
  dropItemText: { fontSize: 14, color: colors.text },
});
