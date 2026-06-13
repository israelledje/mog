import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, Clock, Package, Truck, MapPin, CheckCircle2 } from 'lucide-react-native';
import { colors, fonts, spacing } from '../constants/theme';
import type { TimelineStep } from '../types';

const STEP_ICONS: Record<string, any> = {
  pending_reception: Clock,
  received: Package,
  grouped: Package,
  loaded: Package,
  closed: Package,
  loading: Package,
  departed: Truck,
  in_transit: MapPin,
  arrived: MapPin,
  distributed: MapPin,
  delivered: CheckCircle2,
};

const FULL_STEPS = [
  'pending_reception',
  'received',
  'loaded',
  'in_transit',
  'arrived',
  'distributed',
  'delivered'
];

export default function Timeline({ steps, currentStatus }: { steps: TimelineStep[], currentStatus?: string }) {
  const { t } = useTranslation();
  
  // Find the index of the current status in our predictive pipeline
  const currentStepIndex = currentStatus ? FULL_STEPS.indexOf(currentStatus) : -1;
  
  // Build the list of future steps
  const futureSteps = currentStepIndex >= 0 
    ? FULL_STEPS.slice(currentStepIndex + 1).map(stepKey => ({
        status: stepKey,
        label: t(`steps.${stepKey}`),
        timestamp: '',
        location: '',
        isFuture: true
      }))
    : [];

  // Combine actual events with future steps
  const allSteps = [
    ...steps.map(s => ({ ...s, isFuture: false })),
    ...futureSteps
  ];
  
  // Calculate completion percentage
  const total = FULL_STEPS.length;
  const progress = Math.max(0, Math.min(100, Math.round(((currentStepIndex + 1) / total) * 100)));

  return (
    <View style={styles.wrap} testID="timeline">
      <View style={styles.progressWrap}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>{t('package.progress')}</Text>
          <Text style={styles.progressValue}>{progress}%</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
      </View>

      {allSteps.map((s, idx) => {
        const isFuture = s.isFuture;
        const isCurrent = !isFuture && idx === steps.length - 1;
        const isDone = !isFuture && !isCurrent;
        const isLast = idx === allSteps.length - 1;
        const Icon = STEP_ICONS[s.status] || Clock;
        
        return (
          <View key={`step-${idx}`} style={[styles.row, isFuture && styles.rowFuture]}>
            <View style={styles.left}>
              <View
                style={[
                  styles.node,
                  isDone && styles.nodeDone,
                  isCurrent && styles.nodeCurrent,
                  isFuture && styles.nodeFuture
                ]}
              >
                {isDone ? (
                  <Check size={10} color="#fff" strokeWidth={4} />
                ) : (
                  <Icon size={10} color={isCurrent ? '#fff' : '#9ca3af'} />
                )}
              </View>
              {!isLast && (
                <View style={[styles.line, (isDone || isCurrent) && styles.lineDone, isFuture && styles.lineFuture]} />
              )}
            </View>
            <View style={styles.content}>
              <View style={styles.headerRow}>
                <Text style={[styles.label, (isDone || isCurrent) && styles.labelActive, isFuture && styles.labelFuture]}>
                  {s.label}
                </Text>
              </View>
              {(!isFuture && (s.location || s.timestamp)) && (
                <View style={styles.detailsRow}>
                  {s.location ? <Text style={styles.subtext}>{s.location}</Text> : null}
                  {s.timestamp ? (
                    <Text style={styles.date}>
                      {s.location ? ' • ' : ''}
                      {new Date(s.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.sm,
  },
  progressWrap: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  row: {
    flexDirection: 'row',
  },
  rowFuture: {
    opacity: 0.7,
  },
  left: {
    width: 32,
    alignItems: 'center',
  },
  node: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    marginTop: 2,
  },
  nodeDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  nodeCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  nodeFuture: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
  },
  line: {
    position: 'absolute',
    top: 24,
    bottom: 0,
    left: 15,
    width: 2,
    backgroundColor: '#F3F4F6',
  },
  lineDone: {
    backgroundColor: colors.success,
    opacity: 0.5,
  },
  lineFuture: {
    backgroundColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  content: {
    flex: 1,
    paddingLeft: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    fontFamily: fonts.body,
  },
  labelActive: {
    color: colors.text,
    fontWeight: '700',
  },
  labelFuture: {
    color: '#9ca3af',
  },
  date: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  subtext: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
});
