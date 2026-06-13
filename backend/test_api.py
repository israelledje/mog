import asyncio
import httpx

async def test_api():
    base_url = "http://127.0.0.1:8000/api"
    
    # 1. Login
    response = await httpx.AsyncClient().post(
        f"{base_url}/auth/login",
        json={"email": "israelledje@gmail.com", "password": "Admin@2026"}
    )
    
    if response.status_code != 200:
        print("Login failed:", response.text)
        return
        
    token = response.json()["access_token"]
    
    # 2. Get KPI
    headers = {"Authorization": f"Bearer {token}"}
    kpi_resp = await httpx.AsyncClient().get(f"{base_url}/colis/kpi", headers=headers)
    print("KPI Response:", kpi_resp.text)
    
    # 3. Get Colis
    colis_resp = await httpx.AsyncClient().get(f"{base_url}/colis/", headers=headers)
    print("Colis Status:", colis_resp.status_code)
    print("Colis Body:", colis_resp.text)

if __name__ == "__main__":
    asyncio.run(test_api())
