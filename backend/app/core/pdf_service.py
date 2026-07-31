from fpdf import FPDF
import qrcode
from io import BytesIO
from pathlib import Path
from typing import List, Any
from datetime import datetime

# Couleurs marque M.O.G (papier à en-tête)
MOG_BLUE = (0, 82, 164)
MOG_GREEN = (0, 170, 68)
MOG_TEXT = (55, 65, 81)
MOG_MUTED = (107, 114, 128)

LETTERHEAD_PATH = Path(__file__).resolve().parent.parent / "assets" / "mog_letterhead.jpg"

# Zone utile sous l'en-tête / au-dessus du pied du papier à en-tête A4
TOP_MARGIN_MM = 42
BOTTOM_MARGIN_MM = 38
LEFT_MARGIN_MM = 16
RIGHT_MARGIN_MM = 16

# Caractères hors Helvetica/latin-1 fréquents dans les saisies (Word, mobile, ZH…)
_UNICODE_REPLACEMENTS = str.maketrans({
    "\u2014": "-",   # —
    "\u2013": "-",   # –
    "\u2012": "-",
    "\u2010": "-",
    "\u2212": "-",
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u00ab": '"',
    "\u00bb": '"',
    "\u2026": "...",
    "\u00a0": " ",
    "\u2022": "-",
    "\u00b7": "-",
    "\ufffd": "?",
})


def _pdf_text(value: Any) -> str:
    """Texte compatible police core Helvetica (latin-1) — évite les 500 FPDF."""
    if value is None:
        return ""
    text = str(value).translate(_UNICODE_REPLACEMENTS)
    return text.encode("latin-1", errors="replace").decode("latin-1")


class MogDocumentPDF(FPDF):
    """PDF documents with the official M.O.G letterhead as full-page background."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.set_margins(LEFT_MARGIN_MM, TOP_MARGIN_MM, RIGHT_MARGIN_MM)
        self.set_auto_page_break(auto=True, margin=BOTTOM_MARGIN_MM)

    def header(self):
        if LETTERHEAD_PATH.exists():
            self.image(str(LETTERHEAD_PATH), x=0, y=0, w=210, h=297)
        self.set_y(TOP_MARGIN_MM)

    def footer(self):
        # Numéro de page au-dessus des motifs du pied de page
        self.set_y(-BOTTOM_MARGIN_MM + 6)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*MOG_MUTED)
        self.cell(0, 8, f"Page {self.page_no()}/{{nb}}", align="C")

    def cell(self, w, h=0, text="", *args, **kwargs):
        # fpdf2 utilise parfois `txt=` ; normaliser vers text=
        if "txt" in kwargs and not text:
            text = kwargs.pop("txt")
        return super().cell(w, h, _pdf_text(text), *args, **kwargs)

    def multi_cell(self, w, h=0, text="", *args, **kwargs):
        if "txt" in kwargs and not text:
            text = kwargs.pop("txt")
        return super().multi_cell(w, h, _pdf_text(text), *args, **kwargs)

def _pdf_bytes(pdf: FPDF) -> BytesIO:
    output = BytesIO()
    pdf_out = pdf.output(dest="S")
    if isinstance(pdf_out, str):
        output.write(pdf_out.encode("latin-1"))
    else:
        output.write(bytes(pdf_out))
    output.seek(0)
    return output


# Alias conservé pour imports existants
InvoicePDF = MogDocumentPDF


def generate_invoice_pdf(package_data: dict) -> BytesIO:
    pdf = MogDocumentPDF()
    pdf.alias_nb_pages()
    pdf.add_page()

    # 1. Section Tracking
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*MOG_BLUE)
    pdf.cell(0, 10, f"FACTURE : {package_data['tracking_number']}", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*MOG_MUTED)
    created = package_data.get("created_at")
    date_str = created.strftime("%d/%m/%Y") if hasattr(created, "strftime") else "N/A"
    pdf.cell(0, 5, f"Date: {date_str}", ln=True)
    pdf.ln(5)

    # 2. Section Expéditeur / Destinataire
    pdf.set_fill_color(240, 245, 250)
    pdf.set_text_color(*MOG_TEXT)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(89, 10, " FOURNISSEUR", fill=True)
    pdf.cell(89, 10, " CLIENT", fill=True, ln=True)

    pdf.set_font("Helvetica", "", 10)
    pdf.cell(89, 7, f"Nom: {package_data.get('supplier_name', 'N/A')}")
    pdf.cell(89, 7, f"Client (Email): {package_data.get('owner_id', 'N/A')}", ln=True)

    pdf.cell(89, 7, f"Plateforme: {package_data.get('platform', 'N/A')}")
    pdf.cell(89, 7, "Téléphone: N/A", ln=True)  # accent-safe core font

    pdf.cell(89, 7, f"Transport: {str(package_data.get('transport_mode', 'N/A')).upper()}")
    pdf.cell(89, 7, f"Assurance: {'Oui' if package_data.get('insurance_enabled') else 'Non'}", ln=True)
    pdf.ln(10)

    # 3. Détails du Colis
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*MOG_BLUE)
    pdf.cell(0, 10, "DETAIL DE LA MARCHANDISE", ln=True, border="B")
    pdf.ln(2)

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*MOG_TEXT)
    pdf.cell(40, 7, "Description:", border=0)
    pdf.multi_cell(0, 7, package_data.get("description", "") or "")

    pdf.cell(40, 7, "Catégorie:", border=0)
    pdf.cell(0, 7, package_data.get("category", "") or "", ln=True)

    pdf.cell(40, 7, "Poids (Kg):", border=0)
    pdf.cell(0, 7, f"{package_data.get('weight_real', 0)} Kg", ln=True)

    val_declaree = package_data.get("declared_value", 0)
    currency = package_data.get("currency", "CNY")
    pdf.cell(40, 7, "Valeur déclarée:", border=0)
    pdf.cell(0, 7, f"{val_declaree} {currency}", ln=True)
    pdf.ln(5)

    # 4. QR Code (dans la zone de contenu, pas sur l'en-tête)
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(f"https://tracker.cargoline.com/track/{package_data.get('tracking_number', '')}")
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")

    qr_buffer = BytesIO()
    qr_img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)

    qr_y = pdf.get_y()
    pdf.image(qr_buffer, x=150, y=qr_y, w=35)
    pdf.ln(40)

    # 5. Section Prix
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(0)

    base_price = package_data.get("total_price", 0) or 0
    include_vat = package_data.get("include_vat", False)

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
    pdf.set_fill_color(*MOG_BLUE)
    pdf.set_text_color(255)
    pdf.cell(0, 12, f" TOTAL À PAYER : {total_price:,.0f} FCFA ", ln=True, align="R", fill=True)

    return _pdf_bytes(pdf)


def generate_manifest_pdf(container_data: dict, packages: List[dict]) -> BytesIO:
    pdf = MogDocumentPDF()
    pdf.alias_nb_pages()
    pdf.add_page()

    title = (
        "MANIFESTE DE CHARGEMENT"
        if container_data.get("transport_mode") == "sea"
        else "LISTE DE COLISAGE AÉRIEN"
    )
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*MOG_BLUE)
    pdf.cell(0, 10, title, ln=True, align="L")

    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*MOG_TEXT)
    pdf.cell(0, 7, f"RÉFÉRENCE : {container_data.get('container_number', 'N/A')}", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*MOG_MUTED)
    pdf.cell(0, 5, f"Destination : {container_data.get('destination_city', 'N/A')}", ln=True)
    created = container_data.get("created_at")
    date_str = created.strftime("%d/%m/%Y") if hasattr(created, "strftime") else "N/A"
    pdf.cell(0, 5, f"Date de création : {date_str}", ln=True)
    pdf.ln(10)

    usable = pdf.epw
    col_track, col_desc, col_dest, col_weight = usable * 0.22, usable * 0.40, usable * 0.22, usable * 0.16

    pdf.set_fill_color(*MOG_BLUE)
    pdf.set_text_color(255)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(col_track, 10, " TRACKING", fill=True)
    pdf.cell(col_desc, 10, " DESCRIPTION", fill=True)
    pdf.cell(col_dest, 10, " DESTINATAIRE", fill=True)
    pdf.cell(col_weight, 10, " POIDS (KG)", fill=True, ln=True)

    pdf.set_text_color(0)
    pdf.set_font("Helvetica", "", 9)
    total_weight = 0.0

    for pkg in packages:
        pdf.cell(col_track, 8, str(pkg.get("tracking_number", ""))[:18], border="B")
        x = pdf.get_x()
        y = pdf.get_y()
        desc = (pkg.get("content_description") or pkg.get("description") or "")[:40]
        pdf.multi_cell(col_desc, 8, desc, border="B")
        pdf.set_xy(x + col_desc, y)

        pdf.cell(col_dest, 8, str(pkg.get("receiver_name", ""))[:15], border="B")
        w = float(pkg.get("weight_estimated") or pkg.get("weight_real") or 0)
        pdf.cell(col_weight, 8, f"{w}", border="B", ln=True, align="R")
        total_weight += w

    pdf.ln(10)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*MOG_TEXT)
    pdf.cell(usable * 0.6, 10, f"NOMBRE TOTAL DE COLIS : {len(packages)}")
    pdf.set_fill_color(240, 245, 250)
    pdf.cell(usable * 0.4, 10, f" POIDS TOTAL : {total_weight:,.2f} KG ", fill=True, ln=True, align="R")

    return _pdf_bytes(pdf)


def generate_customer_invoice_pdf(invoice: dict, packages: List[dict], customer: dict) -> BytesIO:
    pdf = MogDocumentPDF()
    pdf.alias_nb_pages()
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*MOG_BLUE)
    pdf.cell(0, 10, f"FACTURE : {invoice['invoice_number']}", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*MOG_MUTED)
    created = invoice.get("created_at")
    date_str = created.strftime("%d/%m/%Y") if hasattr(created, "strftime") else "N/A"
    pdf.cell(0, 5, f"Date: {date_str}", ln=True)
    pdf.ln(5)

    pdf.set_fill_color(240, 245, 250)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*MOG_TEXT)
    pdf.cell(0, 10, " CLIENT", fill=True, ln=True)
    pdf.set_font("Helvetica", "", 10)
    customer_name = customer.get("full_name") if customer else "N/A"
    customer_email = invoice.get("customer_id", "N/A")
    pdf.cell(0, 7, f"Nom: {customer_name}", ln=True)
    pdf.cell(0, 7, f"Email: {customer_email}", ln=True)
    if customer and customer.get("phone"):
        pdf.cell(0, 7, f"Téléphone: {customer['phone']}", ln=True)
    pdf.ln(10)

    usable = pdf.epw
    c1, c2, c3, c4, c5 = usable * 0.22, usable * 0.28, usable * 0.14, usable * 0.18, usable * 0.18

    pdf.set_fill_color(*MOG_BLUE)
    pdf.set_text_color(255)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(c1, 10, " TRACKING", fill=True)
    pdf.cell(c2, 10, " DESCRIPTION", fill=True)
    pdf.cell(c3, 10, " QTE", fill=True)
    pdf.cell(c4, 10, " P.U", fill=True)
    pdf.cell(c5, 10, " P.T", fill=True, ln=True, align="R")

    pdf.set_text_color(0)
    pdf.set_font("Helvetica", "", 9)

    package_dict = {p["_id"]: p for p in packages}

    for item in invoice.get("packages", []):
        pkg = package_dict.get(item["package_id"], {})
        tracking = str(pkg.get("tracking_number", item["package_id"]))[:15]
        desc = (pkg.get("description") or "")[:20]
        qte_val = item.get("weight_or_volume", 0) or 0
        unit = item.get("unit", "kg")
        qte = f"{qte_val} {unit}"

        unit_price = item.get("manual_unit_price")
        if unit_price is None:
            unit_price = item.get("calculated_unit_price", 0) or 0

        total_line = unit_price * qte_val

        pdf.cell(c1, 8, tracking, border="B")
        pdf.cell(c2, 8, desc, border="B")
        pdf.cell(c3, 8, qte, border="B")
        pdf.cell(c4, 8, f"{unit_price:,.0f} FCFA", border="B")
        pdf.cell(c5, 8, f"{total_line:,.0f} FCFA", border="B", ln=True, align="R")

    pdf.ln(10)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*MOG_TEXT)

    base_price = invoice.get("total_price", 0) or 0
    discount = invoice.get("discount", 0.0) or 0.0
    include_vat = invoice.get("include_vat", False)

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
    pdf.set_fill_color(*MOG_BLUE)
    pdf.set_text_color(255)
    pdf.cell(0, 12, f" TOTAL À PAYER : {total_price:,.0f} FCFA ", ln=True, align="R", fill=True)

    return _pdf_bytes(pdf)


def generate_client_packing_list_pdf(container_data: dict, packages: List[dict], customer: dict) -> BytesIO:
    pdf = MogDocumentPDF()
    pdf.alias_nb_pages()
    pdf.add_page()

    # 1. Titre document (sous le papier à en-tête)
    pdf.set_text_color(*MOG_BLUE)
    pdf.set_font("Helvetica", "B", 22)
    pdf.cell(0, 12, "PACKING LIST", ln=True, align="L")

    pdf.set_text_color(*MOG_MUTED)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, f"Document généré le {datetime.now().strftime('%d/%m/%Y')}", ln=True)
    pdf.ln(8)

    # 2. Section Client et Expédition
    y_start = pdf.get_y()
    usable = pdf.epw
    half = usable / 2

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*MOG_TEXT)
    pdf.cell(half, 6, "CLIENT", ln=True)
    pdf.set_font("Helvetica", "B", 12)
    customer_name = (customer or {}).get("full_name") or (customer or {}).get("email") or "N/A"
    pdf.cell(half, 6, customer_name, ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*MOG_MUTED)
    pdf.cell(half, 6, f"Email: {(customer or {}).get('email', 'N/A')}", ln=True)
    if (customer or {}).get("phone"):
        pdf.cell(half, 6, f"Tél: {customer['phone']}", ln=True)

    pdf.set_xy(LEFT_MARGIN_MM + half, y_start)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*MOG_TEXT)
    pdf.cell(half, 6, "EXPÉDITION", ln=True, align="R")

    pdf.set_xy(LEFT_MARGIN_MM + half, pdf.get_y())
    pdf.set_font("Courier", "B", 14)
    pdf.cell(half, 6, container_data.get("container_number", "N/A"), ln=True, align="R")

    pdf.set_xy(LEFT_MARGIN_MM + half, pdf.get_y())
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*MOG_MUTED)
    d = container_data.get("departure_date", container_data.get("created_at"))
    pdf.cell(
        half,
        6,
        f"Départ : {d.strftime('%d/%m/%Y') if hasattr(d, 'strftime') else 'N/A'}",
        ln=True,
        align="R",
    )

    pdf.set_xy(LEFT_MARGIN_MM + half, pdf.get_y())
    mode = str(container_data.get("mode") or container_data.get("transport_mode") or "N/A").upper()
    pdf.cell(half, 6, f"Mode : {mode}", ln=True, align="R")

    pdf.ln(12)

    # 3. Encadré Récapitulatif
    total_weight = sum(float(p.get("weight_real", p.get("weight_estimated", 0)) or 0) for p in packages)
    total_volume = sum(float(p.get("weight_volumetric", p.get("volume", 0)) or 0) for p in packages)

    col = usable / 3
    pdf.set_fill_color(240, 245, 250)
    y_box = pdf.get_y()
    pdf.cell(0, 22, "", fill=True, ln=False)
    pdf.set_xy(LEFT_MARGIN_MM, y_box + 2)

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*MOG_MUTED)
    pdf.cell(col, 6, "COLIS TOTAL", align="C")
    pdf.cell(col, 6, "POIDS TOTAL", align="C")
    pdf.cell(col, 6, "VOLUME TOTAL", ln=True, align="C")

    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*MOG_BLUE)
    pdf.cell(col, 10, f"{len(packages)}", align="C")
    pdf.cell(col, 10, f"{total_weight:,.2f} kg", align="C")
    pdf.cell(col, 10, f"{total_volume:,.2f} CBM", ln=True, align="C")
    pdf.ln(8)

    # 4. Tableau des Colis
    t1, t2, t3, t4 = usable * 0.25, usable * 0.45, usable * 0.15, usable * 0.15
    pdf.set_fill_color(249, 250, 251)
    pdf.set_text_color(*MOG_TEXT)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(t1, 10, " N SUIVI", fill=True, border="B")
    pdf.cell(t2, 10, " DESCRIPTION", fill=True, border="B")
    pdf.cell(t3, 10, " POIDS (kg)", fill=True, align="R", border="B")
    pdf.cell(t4, 10, " VALEUR", fill=True, align="R", border="B", ln=True)

    pdf.set_font("Helvetica", "", 9)

    for i, pkg in enumerate(packages):
        fill = i % 2 == 1
        pdf.set_fill_color(249, 250, 251)

        pdf.set_font("Courier", "", 9)
        pdf.cell(t1, 8, str(pkg.get("tracking_number", "N/A"))[:18], fill=fill, border="B")

        pdf.set_font("Helvetica", "", 9)
        desc = (pkg.get("description") or pkg.get("content_description") or "")[:50]
        pdf.cell(t2, 8, desc, fill=fill, border="B")

        w = float(pkg.get("weight_real", pkg.get("weight_estimated", 0)) or 0)
        v = float(pkg.get("declared_value", 0) or 0)
        c = pkg.get("currency", "CNY")

        pdf.cell(t3, 8, f"{w:,.2f}", fill=fill, border="B", align="R")
        pdf.cell(t4, 8, f"{v:,.0f} {c}", fill=fill, border="B", ln=True, align="R")

    pdf.ln(12)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(*MOG_GREEN)
    pdf.cell(0, 8, "SARL M.O.G GROUP MULTISERVICE - Import-Export & Groupage", align="C")

    return _pdf_bytes(pdf)
