import os

# Chemin absolu des fichiers uploadés (volume Docker : /app/uploads)
UPLOAD_DIR = os.path.abspath(os.environ.get("UPLOAD_DIR", "uploads"))

def upload_file_path(filename: str) -> str:
    return os.path.join(UPLOAD_DIR, filename)

def public_upload_url(filename: str) -> str:
    return f"/uploads/{filename}"
