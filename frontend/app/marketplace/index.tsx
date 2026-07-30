import { Redirect } from 'expo-router';

/** Ancienne route stack → onglet avec menu principal */
export default function MarketplaceRedirect() {
  return <Redirect href="/(tabs)/marketplace" />;
}
