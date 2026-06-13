import React from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Home, Package, Ship, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../src/constants/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenListeners={{
        tabPress: () => Haptics.selectionAsync(),
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 8,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} strokeWidth={2.2} />,
          tabBarTestID: 'tab-home',
        }}
      />
      <Tabs.Screen
        name="colis"
        options={{
          title: t('tabs.packages'),
          tabBarIcon: ({ color, size }) => <Package size={size} color={color} strokeWidth={2.2} />,
          tabBarTestID: 'tab-colis',
        }}
      />
      <Tabs.Screen
        name="expeditions"
        options={{
          title: t('tabs.shipments'),
          tabBarIcon: ({ color, size }) => <Ship size={size} color={color} strokeWidth={2.2} />,
          tabBarTestID: 'tab-expeditions',
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <User size={size} color={color} strokeWidth={2.2} />,
          tabBarTestID: 'tab-profil',
        }}
      />
    </Tabs>
  );
}
