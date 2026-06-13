from fpdf import FPDF
import qrcode
from io import BytesIO
import os
from typing import List
from datetime import datetime
from app.core.config import settings

class InvoicePDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 20)
        self.set_text_color(41, 128, 185) # Couleur primaire
        self.cell(0, 10, settings.COMPANY_NAME.upper(), ln=True, align="C")
        self.set_font("Helvetica", "", 10)
        self.set_text_color(100)
        self.cell(0, 5, settings.COMPANY_TAGLINE, ln=True, align="C")
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}} - Facture générée automatiquement par CargoTracker", align="C")

def generate_invoice_pdf(package_data: dict) -> BytesIO:
    pdf = InvoicePDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # 1. Section Tracking
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(0)
    pdf.cell(0, 10, f"FACTURE : {package_data['tracking_number']}", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, f"Date: {package_data['created_at'].strftime('%d/%m/%Y')}", ln=True)
    pdf.ln(5)
    
    # 2. Section Expéditeur / Destinataire
    pdf.set_fill_color(240, 240, 240)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(95, 10, " FOURNISSEUR", fill=True)
    pdf.cell(95, 10, " CLIENT", fill=True, ln=True)
    
    pdf.set_font("Helvetica", "", 10)
    # Fournisseur
    pdf.cell(95, 7, f"Nom: {package_data.get('supplier_name', 'N/A')}")
    # Client
    pdf.cell(95, 7, f"Client (Email): {package_data.get('owner_id', 'N/A')}", ln=True)
    
    pdf.cell(95, 7, f"Plateforme: {package_data.get('platform', 'N/A')}")
    pdf.cell(95, 7, f"Téléphone: N/A", ln=True)
    
    pdf.cell(95, 7, f"Transport: {package_data.get('transport_mode', 'N/A').upper()}")
    pdf.cell(95, 7, f"Assurance: {'Oui' if package_data.get('insurance_enabled') else 'Non'}", ln=True)
    pdf.ln(10)
    
    # 3. Détails du Colis
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 10, "DETAIL DE LA MARCHANDISE", ln=True, border="B")
    pdf.ln(2)
    
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(40, 7, "Description:", border=0)
    pdf.multi_cell(0, 7, package_data.get('description', ''))
    
    pdf.cell(40, 7, "Catégorie:", border=0)
    pdf.cell(0, 7, package_data.get('category', ''), ln=True)
    
    pdf.cell(40, 7, "Poids (Kg):", border=0)
    pdf.cell(0, 7, f"{package_data.get('weight_real', 0)} Kg", ln=True)
    
    val_declaree = package_data.get('declared_value', 0)
    currency = package_data.get('currency', 'CNY')
    pdf.cell(40, 7, "Valeur Déclarée:", border=0)
    pdf.cell(0, 7, f"{val_declaree} {currency}", ln=True)
    pdf.ln(5)
    
    # 4. QR Code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(f"https://tracker.cargoline.com/track/{package_data.get('tracking_number', '')}")
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    
    # Sauver QR temp
    qr_buffer = BytesIO()
    qr_img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    
    # Ajouter QR au PDF
    pdf.image(qr_buffer, x=150, y=10, w=40)
    
    # 5. Section Prix
    pdf.ln(10)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(0)
    
    # Récupérer les prix
    base_price = package_data.get('total_price', 0)
    include_vat = package_data.get('include_vat', False)
    
    pdf.cell(140, 7, "Sous-total Hors Taxes", align="R")
    pdf.cell(0, 7, f"{base_price:,.0f} FCFA", ln=True, align="R")
    
    if include_vat:
        vat_amount = base_price * 0.1925
        pdf.cell(140, 7, "TVA (19.25%)", align="R")
        pdf.cell(0, 7, f"{vat_amount:,.0f} FCFA", ln=True, align="R")
        total_price = base_price + vat_amount
    else:
        total_price = base_price
        
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_fill_color(41, 128, 185)
    pdf.set_text_color(255)
    pdf.cell(0, 12, f" TOTAL À PAYER : {total_price:,.0f} FCFA ", ln=True, align="R", fill=True)
    
    # Output en mémoire
    output = BytesIO()
    pdf_out = pdf.output(dest="S")
    if isinstance(pdf_out, str):
        output.write(pdf_out.encode("latin-1"))
    else:
        output.write(bytes(pdf_out))
    output.seek(0)
    return output

def generate_manifest_pdf(container_data: dict, packages: List[dict]) -> BytesIO:
    pdf = InvoicePDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # 1. En-tête Manifeste
    title = "MANIFESTE DE CHARGEMENT" if container_data['transport_mode'] == 'sea' else "LISTE DE COLISAGE AÉRIEN"
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, title, ln=True, align="L")
    
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 7, f"RÉFÉRENCE : {container_data['container_number']}", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, f"Destination : {container_data['destination_city']}", ln=True)
    pdf.cell(0, 5, f"Date de création : {container_data['created_at'].strftime('%d/%m/%Y')}", ln=True)
    pdf.ln(10)
    
    # 2. Tableau des Colis
    pdf.set_fill_color(41, 128, 185)
    pdf.set_text_color(255)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(40, 10, " TRACKING", fill=True)
    pdf.cell(80, 10, " DESCRIPTION", fill=True)
    pdf.cell(40, 10, " DESTINATAIRE", fill=True)
    pdf.cell(30, 10, " POIDS (KG)", fill=True, ln=True)
    
    pdf.set_text_color(0)
    pdf.set_font("Helvetica", "", 9)
    total_weight = 0
    
    for pkg in packages:
        # Alterner les couleurs de ligne (subtil)
        pdf.cell(40, 8, pkg['tracking_number'], border="B")
        # Multi-cell pour la description si trop longue
        x = pdf.get_x()
        y = pdf.get_y()
        pdf.multi_cell(80, 8, pkg['content_description'][:40] + "...", border="B")
        pdf.set_xy(x + 80, y)
        
        pdf.cell(40, 8, pkg['receiver_name'][:15], border="B")
        pdf.cell(30, 8, f"{pkg['weight_estimated']}", border="B", ln=True, align="R")
        total_weight += pkg['weight_estimated']
    
    # 3. Récapitulatif Final
    pdf.ln(10)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(120, 10, f"NOMBRE TOTAL DE COLIS : {len(packages)}")
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(70, 10, f" POIDS TOTAL : {total_weight:,.2f} KG ", fill=True, ln=True, align="R")
    
    output = BytesIO()
    pdf_out = pdf.output(dest="S")
    if isinstance(pdf_out, str):
        output.write(pdf_out.encode("latin-1"))
    else:
        output.write(bytes(pdf_out))
    output.seek(0)
    return output

def generate_customer_invoice_pdf(invoice: dict, packages: List[dict], customer: dict) -> BytesIO:
    pdf = InvoicePDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # Header
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(0)
    pdf.cell(0, 10, f"FACTURE : {invoice['invoice_number']}", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, f"Date: {invoice['created_at'].strftime('%d/%m/%Y')}", ln=True)
    pdf.ln(5)
    
    # Customer Info
    pdf.set_fill_color(240, 240, 240)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 10, " CLIENT", fill=True, ln=True)
    pdf.set_font("Helvetica", "", 10)
    customer_name = customer.get("full_name") if customer else "N/A"
    customer_email = invoice.get("customer_id", "N/A")
    pdf.cell(0, 7, f"Nom: {customer_name}", ln=True)
    pdf.cell(0, 7, f"Email: {customer_email}", ln=True)
    if customer and customer.get("phone"):
        pdf.cell(0, 7, f"Téléphone: {customer['phone']}", ln=True)
    pdf.ln(10)
    
    # Packages Table
    pdf.set_fill_color(41, 128, 185)
    pdf.set_text_color(255)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(40, 10, " TRACKING", fill=True)
    pdf.cell(50, 10, " DESCRIPTION", fill=True)
    pdf.cell(30, 10, " QTE", fill=True)
    pdf.cell(35, 10, " P.U", fill=True)
    pdf.cell(35, 10, " P.T", fill=True, ln=True, align="R")
    
    pdf.set_text_color(0)
    pdf.set_font("Helvetica", "", 9)
    
    package_dict = {p["_id"]: p for p in packages}
    
    for item in invoice.get("packages", []):
        pkg = package_dict.get(item["package_id"], {})
        tracking = pkg.get("tracking_number", item["package_id"])[:15]
        desc = pkg.get("description", "")[:20]
        qte_val = item.get('weight_or_volume', 0)
        unit = item.get('unit', 'kg')
        qte = f"{qte_val} {unit}"
        
        unit_price = item.get("manual_unit_price")
        if unit_price is None:
            unit_price = item.get("calculated_unit_price", 0)
            
        total_line = unit_price * qte_val
            
        pdf.cell(40, 8, tracking, border="B")
        pdf.cell(50, 8, desc, border="B")
        pdf.cell(30, 8, qte, border="B")
        pdf.cell(35, 8, f"{unit_price:,.0f} FCFA", border="B")
        pdf.cell(35, 8, f"{total_line:,.0f} FCFA", border="B", ln=True, align="R")
        
    # Totals
    pdf.ln(10)
    pdf.set_font("Helvetica", "B", 10)
    
    base_price = invoice.get('total_price', 0)
    discount = invoice.get('discount', 0.0)
    include_vat = invoice.get('include_vat', False)
    
    pdf.cell(140, 7, "Sous-total Hors Taxes", align="R")
    pdf.cell(50, 7, f"{base_price:,.0f} FCFA", ln=True, align="R")
    
    net_ht = base_price
    if discount > 0:
        pdf.cell(140, 7, "Remise", align="R")
        pdf.cell(50, 7, f"- {discount:,.0f} FCFA", ln=True, align="R")
        net_ht -= discount
    
    if include_vat:
        vat_amount = net_ht * 0.1925
        pdf.cell(140, 7, "TVA (19.25%)", align="R")
        pdf.cell(50, 7, f"{vat_amount:,.0f} FCFA", ln=True, align="R")
        total_price = net_ht + vat_amount
    else:
        total_price = net_ht
        
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_fill_color(41, 128, 185)
    pdf.set_text_color(255)
    pdf.cell(0, 12, f" TOTAL À PAYER : {total_price:,.0f} FCFA ", ln=True, align="R", fill=True)
    
    output = BytesIO()
    pdf_out = pdf.output(dest="S")
    if isinstance(pdf_out, str):
        output.write(pdf_out.encode("latin-1"))
    else:
        output.write(bytes(pdf_out))
    output.seek(0)
    output.seek(0)
    return output

def generate_client_packing_list_pdf(container_data: dict, packages: List[dict], customer: dict) -> BytesIO:
    pdf = InvoicePDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # Couleurs
    primary_color = (27, 58, 107) # #1B3A6B
    text_color = (55, 65, 81)     # #374151
    
    # 1. En-tête
    pdf.set_text_color(*primary_color)
    pdf.set_font("Helvetica", "B", 24)
    pdf.cell(0, 15, "PACKING LIST", ln=True, align="L")
    
    pdf.set_text_color(107, 114, 128)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, f"Document généré le {datetime.now().strftime('%d/%m/%Y')}", ln=True)
    pdf.ln(10)
    
    # 2. Section Client et Expédition
    pdf.set_y(pdf.get_y())
    y_start = pdf.get_y()
    
    # Client (Gauche)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*text_color)
    pdf.cell(90, 6, "CLIENT", ln=True)
    pdf.set_font("Helvetica", "B", 12)
    customer_name = customer.get("full_name", customer.get("email", "N/A"))
    pdf.cell(90, 6, customer_name, ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(107, 114, 128)
    pdf.cell(90, 6, f"Email: {customer.get('email', 'N/A')}", ln=True)
    if customer.get("phone"):
        pdf.cell(90, 6, f"Tél: {customer['phone']}", ln=True)
        
    # Expédition (Droite)
    pdf.set_xy(110, y_start)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*text_color)
    pdf.cell(90, 6, "EXPÉDITION", ln=True, align="R")
    
    pdf.set_xy(110, pdf.get_y())
    pdf.set_font("Courier", "B", 14)
    pdf.cell(90, 6, container_data.get('container_number', 'N/A'), ln=True, align="R")
    
    pdf.set_xy(110, pdf.get_y())
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(107, 114, 128)
    d = container_data.get('departure_date', container_data.get('created_at'))
    pdf.cell(90, 6, f"Départ : {d.strftime('%d/%m/%Y') if hasattr(d, 'strftime') else 'N/A'}", ln=True, align="R")
    
    pdf.set_xy(110, pdf.get_y())
    mode = container_data.get('mode', 'N/A').upper()
    pdf.cell(90, 6, f"Mode : {mode}", ln=True, align="R")
    
    pdf.ln(15)
    
    # 3. Encadré Récapitulatif
    total_weight = sum([float(p.get('weight_real', p.get('weight_estimated', 0)) or 0) for p in packages])
    total_volume = sum([float(p.get('weight_volumetric', p.get('volume', 0)) or 0) for p in packages])
    
    pdf.set_fill_color(243, 244, 246)
    pdf.cell(0, 20, "", fill=True, ln=False) # Background
    pdf.set_xy(10, pdf.get_y() + 2)
    
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(107, 114, 128)
    pdf.cell(63, 6, "COLIS TOTAL", align="C")
    pdf.cell(63, 6, "POIDS TOTAL", align="C")
    pdf.cell(63, 6, "VOLUME TOTAL", ln=True, align="C")
    
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*primary_color)
    pdf.cell(63, 10, f"{len(packages)}", align="C")
    pdf.cell(63, 10, f"{total_weight:,.2f} kg", align="C")
    pdf.cell(63, 10, f"{total_volume:,.2f} CBM", ln=True, align="C")
    pdf.ln(10)
    
    # 4. Tableau des Colis
    pdf.set_fill_color(249, 250, 251)
    pdf.set_text_color(*text_color)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(45, 10, " N° SUIVI", fill=True, border="B")
    pdf.cell(95, 10, " DESCRIPTION", fill=True, border="B")
    pdf.cell(25, 10, " POIDS (kg)", fill=True, align="R", border="B")
    pdf.cell(25, 10, " VALEUR", fill=True, align="R", border="B", ln=True)
    
    pdf.set_font("Helvetica", "", 9)
    
    for i, pkg in enumerate(packages):
        fill = True if i % 2 == 1 else False
        pdf.set_fill_color(249, 250, 251)
        
        y_before = pdf.get_y()
        
        pdf.set_font("Courier", "", 9)
        pdf.cell(45, 8, pkg.get('tracking_number', 'N/A')[:18], fill=fill, border="B")
        
        pdf.set_font("Helvetica", "", 9)
        desc = pkg.get('description', pkg.get('content_description', ''))[:50]
        pdf.cell(95, 8, desc, fill=fill, border="B")
        
        w = float(pkg.get('weight_real', pkg.get('weight_estimated', 0)) or 0)
        v = float(pkg.get('declared_value', 0) or 0)
        c = pkg.get('currency', 'CNY')
        
        pdf.cell(25, 8, f"{w:,.2f}", fill=fill, border="B", align="R")
        pdf.cell(25, 8, f"{v:,.0f} {c}", fill=fill, border="B", ln=True, align="R")
    
    pdf.ln(20)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(156, 163, 175)
    pdf.cell(0, 10, "MOG Cargo - Importation et Groupage depuis la Chine", align="C")
    
    output = BytesIO()
    pdf_out = pdf.output(dest="S")
    if isinstance(pdf_out, str):
        output.write(pdf_out.encode("latin-1"))
    else:
        output.write(bytes(pdf_out))
    output.seek(0)
    return output
