# Cargo Tracker (CargoLine) - PRD

## Overview
A React Native + Expo mobile app for a freight forwarding company shipping packages from China to Cameroon. Users (importers in Cameroon) register, place package orders, track packages from supplier reception to door delivery, and view consolidated shipments (groupages).

## Tech Stack
- **Frontend**: React Native + Expo SDK 54, expo-router, Zustand state, Axios + JWT, react-i18next, expo-haptics, expo-print, expo-secure-store/AsyncStorage, expo-image-picker, expo-notifications, lucide-react-native, react-native-toast-message
- **Backend**: FastAPI + Motor (async MongoDB)
- **Storage**: MongoDB (cargo_app DB)

## Languages
French (default), English, Chinese Simplified — switchable from login & profile screens, persisted.

## Key Features
- 3-slide onboarding (first launch)
- JWT authentication: login, register (with city dropdown), forgot password (OTP), reset password, **token refresh** (60-min access TTL + 30-day refresh)
- Home: greeting, 4 KPI cards, "Ship a package" CTA, next sea/air banners, last 3 packages
- Packages list: search, filter chips, pull-to-refresh, skeleton loaders, status badges, monospace tracking numbers
- Package detail: photo carousel + zoom, info grid, vertical timeline, container card, PDF generation (quote/invoice via expo-print)
- New package: 3-step wizard with **multi-photo image picker (base64 → MongoDB)**; success screen showing China warehouse address
- Shipments list: container info with progress stepper
- Profile: avatar, info, language selector, notification preferences, **Edit Profile screen** with city dropdown + default address editor, **FAQ screen** (8 multi-language items + WhatsApp contact), logout
- Notifications: chronological with read/unread, tap to navigate, mark all read; **proper 404 on missing id**
- **Push notifications scaffolding** (expo-notifications): permission flow, Expo push token registration, backend `/api/auth/push-token` endpoint stores token per user — production-ready for FCM/APNS via EAS Build

## Backend Hardening (Production)
- **Atomic tracking number generation** via `db.counters.find_one_and_update` (concurrency-safe)
- **Unique index** on `tracking_number`
- **Short JWT access TTL** (60 min) + refresh endpoint (`POST /api/auth/refresh`)
- **CORS via env** (`ALLOWED_ORIGINS` from `.env`, `allow_credentials=False`)
- 41/41 backend tests passing

## Demo Account
- Email: `jean@cargo.cm` / Password: `demo123`
- Pre-seeded: 5 packages (varied statuses), 2 groupages, 10 notifications

## Mocked / Stubbed Areas
- Push delivery server (token registration works, but no server-side notification dispatch yet — UI polls)
- OTP delivery returns dev_code in API response (for preview env only)
