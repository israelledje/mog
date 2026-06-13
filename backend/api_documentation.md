# Documentation de l'API Cargo Tracker

Cette documentation détaille les points d'entrée de l'API définis dans `backend/app/main.py`. Le préfixe de base de l'API est `/api`.

---

## Authentification & Profil (`/api/auth`)

### 1. Inscription
- **Route :** `POST /auth/register`
- **Données demandées (JSON) :**
  ```json
  {
    "full_name": "string",
    "email": "email@example.com",
    "phone": "string",
    "password": "string",
    "city": "string",
    "preferred_language": "fr | en | zh" (défaut: "fr")
  }
  ```
- **Réponse (200 OK) :**
  ```json
  {
    "access_token": "jwt_token",
    "refresh_token": "jwt_token",
    "user": { "id", "full_name", "email", "phone", "city", "client_code", ... }
  }
  ```

### 2. Connexion
- **Route :** `POST /auth/login`
- **Données demandées (JSON) :**
  ```json
  {
    "email": "email@example.com",
    "password": "string"
  }
  ```
- **Réponse (200 OK) :**
  ```json
  {
    "access_token": "jwt_token",
    "refresh_token": "jwt_token",
    "user": { ... }
  }
  ```

### 3. Récupérer mon profil
- **Route :** `GET /auth/me`
- **Authentification :** Bearer Token requis.
- **Réponse (200 OK) :** Objet utilisateur actuel.

### 4. Mettre à jour mon profil
- **Route :** `PUT /auth/me`
- **Authentification :** Bearer Token requis.
- **Données demandées (JSON, optionnelles) :**
  ```json
  {
    "full_name": "string",
    "phone": "string",
    "city": "string",
    "default_delivery_address": "string",
    "preferred_language": "fr | en | zh",
    "avatar_url": "string"
  }
  ```
- **Réponse (200 OK) :** Objet utilisateur mis à jour.

### 5. Mot de passe oublié (Demande d'OTP)
- **Route :** `POST /auth/forgot-password`
- **Données demandées (JSON) :**
  ```json
  { "email": "email@example.com" }
  ```
- **Réponse (200 OK) :** `{ "ok": true, "dev_code": "123456" }` (le code est renvoyé pour le dev).

### 6. Vérifier l'OTP
- **Route :** `POST /auth/verify-otp`
- **Données demandées (JSON) :**
  ```json
  { "email": "email@example.com", "code": "123456" }
  ```
- **Réponse (200 OK) :** `{ "ok": true }`

### 7. Réinitialiser le mot de passe
- **Route :** `POST /auth/reset-password`
- **Données demandées (JSON) :**
  ```json
  {
    "email": "email@example.com",
    "code": "123456",
    "new_password": "string"
  }
  ```
- **Réponse (200 OK) :** `{ "ok": true }`

### 8. Rafraîchir le token
- **Route :** `POST /auth/refresh`
- **Données demandées (JSON) :**
  ```json
  { "refresh_token": "jwt_refresh_token" }
  ```
- **Réponse (200 OK) :** `{ "access_token": "new_jwt_token", "refresh_token": "jwt_refresh_token", "user": { ... } }`

### 9. Enregistrer un token Push
- **Route :** `POST /auth/push-token`
- **Authentification :** Bearer Token requis.
- **Données demandées (JSON) :**
  ```json
  {
    "token": "string",
    "platform": "ios | android | web" (défaut: "android")
  }
  ```
- **Réponse (200 OK) :** `{ "ok": true }`

---

## Colis (`/api/colis`)

### 10. Liste des colis
- **Route :** `GET /colis`
- **Authentification :** Bearer Token requis.
- **Réponse (200 OK) :** Liste d'objets colis.

### 11. Détails d'un colis
- **Route :** `GET /colis/{cid}`
- **Authentification :** Bearer Token requis.
- **Réponse (200 OK) :** Objet colis correspondant à `id`.

### 12. Créer un nouveau colis
- **Route :** `POST /colis`
- **Authentification :** Bearer Token requis.
- **Données demandées (JSON) :**
  ```json
  {
    "description": "string",
    "category": "string",
    "transport_mode": "air | sea",
    "weight_real": 0.0,
    "weight_volumetric": 0.0,
    "dimensions": { "l": 0, "w": 0, "h": 0 },
    "declared_value": 0,
    "currency": "CNY | USD",
    "supplier_name": "string",
    "platform": "string",
    "order_ref": "string",
    "insurance_enabled": false,
    "delivery_address": "string",
    "instructions": "string",
    "invoice_base64": "string",
    "photos": ["url1", "url2"]
  }
  ```
- **Réponse (200 OK) :** Objet colis créé avec `id` et `tracking_number`.

---

## Groupages (`/api/groupages`)

### 13. Liste des groupages
- **Route :** `GET /groupages`
- **Authentification :** Bearer Token requis.
- **Réponse (200 OK) :** Liste d'objets groupages.

### 14. Détails d'un groupage
- **Route :** `GET /groupages/{gid}`
- **Authentification :** Bearer Token requis.
- **Réponse (200 OK) :** Objet groupage.

### 15. Prochains groupages (Info)
- **Route :** `GET /groupages/next/info`
- **Authentification :** Bearer Token requis.
- **Réponse (200 OK) :** `{ "sea": { ... }, "air": { ... } }`

---

## Notifications (`/api/notifications`)

### 16. Liste des notifications
- **Route :** `GET /notifications`
- **Authentification :** Bearer Token requis.
- **Réponse (200 OK) :** Liste d'objets notifications.

### 17. Marquer une notification comme lue
- **Route :** `POST /notifications/{nid}/read`
- **Authentification :** Bearer Token requis.
- **Réponse (200 OK) :** `{ "ok": true }`

### 18. Tout marquer comme lu
- **Route :** `POST /notifications/read-all`
- **Authentification :** Bearer Token requis.
- **Réponse (200 OK) :** `{ "ok": true }`

---

## Statistiques & Racine (`/api`)

### 19. Statistiques KPI
- **Route :** `GET /colis/kpi`
- **Authentification :** Bearer Token requis.
- **Réponse (200 OK) :**
  ```json
  {
    "pending": 0,
    "warehouse": 0,
    "transit": 0,
    "delivered": 0
  }
  ```

### 20. Racine de l'API
- **Route :** `GET /`
- **Réponse (200 OK) :** `{ "app": "Cargo Tracker API", "ok": true }`
