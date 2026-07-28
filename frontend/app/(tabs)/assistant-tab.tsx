import { Redirect } from 'expo-router';

/** Placeholder tab — le bouton central ouvre /assistant */
export default function AssistantTabPlaceholder() {
  return <Redirect href="/assistant" />;
}
