# Liste des tâches en attente (TODO) - Frontend

Ce document regroupe les tâches nécessaires pour finaliser l'application pour une mise en production optimale sur les stores.

## 1. Notifications Push (Android)
- [ ] **Créer un projet Firebase** : Allez sur la console Firebase, créez un projet, et ajoutez une application Android avec le package name `com.cargoline.app`.
- [ ] **Télécharger `google-services.json`** : Téléchargez le fichier de configuration Firebase et placez-le à la racine du dossier `frontend`.
- [ ] **Mettre à jour `app.json`** : Ajoutez `"googleServicesFile": "./google-services.json"` dans la section `android` de `app.json`.
- [ ] **Configurer le plugin Expo** : Ajoutez la configuration spécifique à `expo-notifications` dans le tableau `plugins` de `app.json` (pour définir l'icône de notification et la couleur).

## 2. Ergonomie et Résilience
- [ ] **Gestion globale du clavier** : Bien que l'écran de connexion (`login.tsx`) utilise correctement `KeyboardAvoidingView`, vérifiez les autres écrans contenant des formulaires (ex: `profile/edit.tsx`) pour vous assurer que le clavier virtuel ne masque jamais les champs de saisie. Si nécessaire, utilisez la librairie `react-native-keyboard-aware-scroll-view` pour une gestion plus simple.
- [ ] **Mode Hors-Ligne (Offline)** : Installez `@react-native-community/netinfo`. Ajoutez un bandeau d'alerte global dans `_layout.tsx` pour avertir l'utilisateur lorsqu'il perd sa connexion internet. C'est particulièrement utile pour les opérateurs dans les entrepôts où le réseau peut fluctuer.
- [ ] **Mise en cache** : Si l'application doit fonctionner de manière dégradée sans réseau (ex: consulter la liste de ses colis), envisagez d'utiliser un cache persistant pour `Zustand` ou d'intégrer une solution comme `React Query` avec persistance.

## 3. Préparation aux Stores
- [ ] **Icônes et Splash Screen** : Vérifiez que `icon.png` (1024x1024) et `splash-icon.png` respectent les recommandations de taille stricte d'Expo et ne contiennent pas de transparence au niveau de l'arrière-plan (pour l'icône iOS).
- [ ] **Certificats Apple** : Pour publier sur l'App Store, assurez-vous d'avoir un compte développeur Apple actif avant de lancer `eas build -p ios`.
