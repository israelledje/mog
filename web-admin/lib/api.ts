/**
 * URL de base de l'API.
 * En production derrière Nginx : /api (même origine HTTPS).
 * En dev local : définir NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api dans .env.local
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
export const API = API_BASE_URL;
