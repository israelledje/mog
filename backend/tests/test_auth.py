import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
import asyncio

# Données de test
TEST_USER = {
    "email": "test_remote@example.com",
    "password": "password123",
    "full_name": "Test User Remote",
    "city": "Douala"
}

@pytest.mark.asyncio
async def test_register_and_login_remote():
    # Utilisation du transport ASGI pour tester sans lancer le serveur web
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        
        # 1. Tester l'inscription
        print("\n[Test] Inscription de l'utilisateur...")
        response = await ac.post("/api/auth/register", json=TEST_USER)
        
        # Si l'utilisateur existe déjà (cas d'un second run), on ignore l'erreur 400
        if response.status_code == 400:
             print("[Info] L'utilisateur existe déjà, passage au login.")
        else:
            assert response.status_code == 200
            assert response.json()["user"]["email"] == TEST_USER["email"]
            print("✅ Inscription réussie !")

        # 2. Tester le login
        print("[Test] Connexion de l'utilisateur...")
        login_data = {
            "email": TEST_USER["email"],
            "password": TEST_USER["password"]
        }
        response = await ac.post("/api/auth/login", json=login_data)
        
        assert response.status_code == 200
        tokens = response.json()
        assert "access_token" in tokens
        assert "refresh_token" in tokens
        print(f"✅ Connexion réussie ! Token reçu : {tokens['access_token'][:20]}...")

        # 3. Tester le rafraîchissement du token
        print("[Test] Rafraîchissement du token...")
        refresh_data = {"refresh_token": tokens["refresh_token"]}
        response = await ac.post("/api/auth/refresh", json=refresh_data)
        
        assert response.status_code == 200
        assert "access_token" in response.json()
        print("✅ Rafraîchissement réussi !")

if __name__ == "__main__":
    # Pour lancer le test manuellement avec : python backend/tests/test_auth.py
    asyncio.run(test_register_and_login_remote())
