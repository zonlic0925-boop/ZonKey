from fastapi import APIRouter, File, UploadFile, Form
from fastapi.responses import FileResponse
import tempfile
import pathlib
import pikepdf
import uuid
import shutil

router = APIRouter()

@router.post("/api/convert/protect-advanced")
def protect_pdf_advanced(
    file: UploadFile = File(...),
    user_pw: str = Form(""),
    owner_pw: str = Form(""),
    allow_print: str = Form("true"),
    allow_copy: str = Form("true"),
    allow_modify: str = Form("true"),
    allow_fill: str = Form("true")
):
    tmpdir = pathlib.Path(tempfile.gettempdir())
    in_path = tmpdir / f"in_{uuid.uuid4().hex}.pdf"
    out_path = tmpdir / f"out_{uuid.uuid4().hex}.pdf"
    
    with open(in_path, "wb") as f:
        f.write(file.file.read())
        
    perms = pikepdf.Permissions(
        extract=allow_copy == "true",
        modify_assembly=allow_modify == "true",
        modify_other=allow_modify == "true",
        print_highres=allow_print == "true",
        print_lowres=allow_print == "true",
        fill_forms=allow_fill == "true"
    )
    
    with pikepdf.open(in_path) as pdf:
        encryption = pikepdf.Encryption(
            user=user_pw if user_pw else owner_pw,
            owner=owner_pw if owner_pw else user_pw,
            allow=perms
        )
        pdf.save(out_path, encryption=encryption)
        
    return FileResponse(
        out_path,
        media_type="application/pdf",
        filename=f"protected_{file.filename}.pdf"
    )

@router.post("/api/convert/sign-pades")
def sign_pdf_certificate(
    file: UploadFile = File(...)
):
    tmpdir = pathlib.Path(tempfile.gettempdir())
    in_path = tmpdir / f"in_{uuid.uuid4().hex}.pdf"
    out_path = tmpdir / f"out_{uuid.uuid4().hex}.pdf"
    
    with open(in_path, "wb") as f:
        f.write(file.file.read())
        
    # TODO: Connect with pyhanko and actual certificates.
    # Currently acting as a backend capability stub mapped to UI.
    shutil.copy(in_path, out_path)
    
    return FileResponse(
        out_path,
        media_type="application/pdf"
    )
