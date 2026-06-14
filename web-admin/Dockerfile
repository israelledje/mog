FROM node:20-alpine
WORKDIR /app

# Installer les dépendances
COPY package.json package-lock.json ./
RUN npm ci

# Copier le reste du projet et compiler
COPY . .
RUN npm run build

# Exposer le port
EXPOSE 3000

ENV HOSTNAME="0.0.0.0"

# Démarrer le serveur Next.js
CMD ["npm", "start"]
