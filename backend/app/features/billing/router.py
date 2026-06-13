from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from app.core.database import get_database
from app.core.deps import check_role, get_current_user
from app.core.pdf_service import generate_customer_invoice_pdf
from .schemas import InvoiceCreate, InvoiceInDB, InvoiceUpdate
from datetime import datetime
import uuid
import random

router = APIRouter(prefix="/invoices", tags=["Invoices"])

def generate_invoice_number():
    year = datetime.now().year
    month = datetime.now().strftime("%m")
    rand = random.randint(1000, 9999)
    return f"FAC N°_MOG{year}/{month}/{rand}"

@router.post("/", response_model=InvoiceInDB)
async def create_invoice(
    invoice_in: InvoiceCreate,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db = Depends(get_database)
):
    invoice_dict = invoice_in.model_dump()
    invoice_dict.update({
        "_id": str(uuid.uuid4()),
        "invoice_number": generate_invoice_number(),
        "status": "draft",
        "payment_status": "pending",
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    })
    
    await db.invoices.insert_one(invoice_dict)
    
    # Mettre à jour les colis associés avec le prix et le statut de facturation
    for pkg_item in invoice_dict.get("packages", []):
        pkg_id = pkg_item.get("package_id")
        unit_price = pkg_item.get("manual_unit_price")
        if unit_price is None:
            unit_price = pkg_item.get("calculated_unit_price", 0)
        
        qte = pkg_item.get("weight_or_volume", 0)
        line_total = unit_price * qte
        
        await db.packages.update_one(
            {"_id": pkg_id},
            {"$set": {
                "invoice_status": "draft",
                "invoice_id": invoice_dict["_id"],
                "total_price": line_total
            }}
        )
        
    invoice_dict["id"] = invoice_dict["_id"]
    return invoice_dict

@router.get("/", response_model=List[InvoiceInDB])
async def list_invoices(
    customer_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    query = {}
    if current_user.get("role") == "client":
        query["customer_id"] = current_user["email"]
    elif customer_id:
        query["customer_id"] = customer_id
        
    cursor = db.invoices.find(query).sort("created_at", -1)
    invoices = []
    async for doc in cursor:
        doc["id"] = doc["_id"]
        # Récupérer les informations du client pour l'affichage admin
        customer = await db.users.find_one({"email": doc["customer_id"]})
        if customer:
            doc["customer_name"] = customer.get("full_name")
        else:
            doc["customer_name"] = doc["customer_id"]
        invoices.append(doc)
    return invoices

@router.get("/{invoice_id}", response_model=InvoiceInDB)
async def get_invoice(
    invoice_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    invoice = await db.invoices.find_one({"_id": invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Facture non trouvée")
        
    is_owner = invoice.get("customer_id") == current_user["email"]
    is_staff = current_user.get("role") in ["admin", "operator"]
    
    if not (is_owner or is_staff):
        raise HTTPException(status_code=403, detail="Accès refusé")
        
    invoice["id"] = invoice["_id"]
    return invoice

@router.patch("/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    update_data: InvoiceUpdate,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db = Depends(get_database)
):
    invoice = await db.invoices.find_one({"_id": invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Facture non trouvée")
        
    update_dict = {k: v for k, v in update_data.model_dump(exclude_unset=True).items() if v is not None}
    update_dict["updated_at"] = datetime.now()
    
    await db.invoices.update_one(
        {"_id": invoice_id},
        {"$set": update_dict}
    )
    
    return {"message": "Facture mise à jour"}

@router.post("/{invoice_id}/finalize")
async def finalize_invoice(
    invoice_id: str,
    current_user: dict = Depends(check_role(["admin", "operator"])),
    db = Depends(get_database)
):
    result = await db.invoices.update_one(
        {"_id": invoice_id},
        {"$set": {"status": "final", "updated_at": datetime.now()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Facture non trouvée")
    return {"message": "Facture confirmée"}

@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: str,
    current_user: dict = Depends(check_role(["admin"])),
    db = Depends(get_database)
):
    result = await db.invoices.delete_one({"_id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Facture non trouvée")
    return {"message": "Facture supprimée"}

@router.get("/{invoice_id}/pdf")
async def get_invoice_pdf(
    invoice_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    invoice = await db.invoices.find_one({"_id": invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Facture non trouvée")
        
    # Get all packages in the invoice
    package_ids = [p["package_id"] for p in invoice.get("packages", [])]
    cursor = db.packages.find({"_id": {"$in": package_ids}})
    packages = []
    async for p in cursor:
        packages.append(p)
        
    # Get user
    customer = await db.users.find_one({"email": invoice["customer_id"]})
    
    pdf_buffer = generate_customer_invoice_pdf(invoice, packages, customer)
    
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={invoice['invoice_number']}.pdf"
        }
    )
