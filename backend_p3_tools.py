"""P3 安全工具后端：PDF 高级权限保护 + PAdES 证书签名（pyhanko, MIT）。

许可合规：pyhanko / pyhanko-certvalidator 均为 MIT，符合 ZonScale 零 AGPL 门禁。
签名凭证由用户自行提供（PEM 证书 + 私钥），服务端不内置任何证书。
"""
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
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
        modify_annotation=allow_fill == "true",
        modify_form=allow_fill == "true",
        print_highres=allow_print == "true",
        print_lowres=allow_print == "true",
    )

    try:
        with pikepdf.open(in_path) as pdf:
            encryption = pikepdf.Encryption(
                user=user_pw if user_pw else owner_pw,
                owner=owner_pw if owner_pw else user_pw,
                allow=perms
            )
            pdf.save(out_path, encryption=encryption)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"加密失败: {exc}")
    finally:
        in_path.unlink(missing_ok=True)

    return FileResponse(
        out_path,
        media_type="application/pdf",
        filename=f"protected_{file.filename}.pdf"
    )


@router.post("/api/convert/sign-pades")
def sign_pdf_pades(
    file: UploadFile = File(...),
    cert_pem: UploadFile = File(...),
    key_pem: UploadFile = File(...),
    key_pass: str = Form(""),
    reason: str = Form(""),
    location: str = Form(""),
):
    """PAdES 签名：用户上传 PEM 证书与私钥（Base64/X.509），pyhanko 附加不可篡改签名。

    诚实边界：本端点不做时间戳 TSA 与证书链在线校验（离线约束），
    签名有效性以 Adobe/阅读器本地验证为准。
    """
    from pyhanko.sign import signers
    from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter

    tmpdir = pathlib.Path(tempfile.gettempdir())
    in_path = tmpdir / f"in_{uuid.uuid4().hex}.pdf"
    cert_path = tmpdir / f"cert_{uuid.uuid4().hex}.pem"
    key_path = tmpdir / f"key_{uuid.uuid4().hex}.pem"
    out_path = tmpdir / f"out_{uuid.uuid4().hex}.pdf"

    for target, upstream in ((in_path, file), (cert_path, cert_pem), (key_path, key_pem)):
        with open(target, "wb") as f:
            f.write(upstream.file.read())

    try:
        signer = signers.SimpleSigner.load(
            cert_file=str(cert_path),
            key_file=str(key_path),
            key_passphrase=key_pass.encode("utf-8") if key_pass else None,
        )
    except (ValueError, TypeError) as exc:
        _cleanup(in_path, cert_path, key_path)
        raise HTTPException(status_code=422, detail=f"证书或私钥无法解析: {exc}")
    if signer is None:
        _cleanup(in_path, cert_path, key_path)
        raise HTTPException(status_code=422, detail="证书/私钥加载失败：请确认 PEM 格式正确")

    try:
        with open(in_path, "rb") as inf:
            writer = IncrementalPdfFileWriter(inf)
            meta_kwargs = {"field_name": "Signature1"}
            if reason:
                meta_kwargs["reason"] = reason
            if location:
                meta_kwargs["location"] = location
            signed = signers.sign_pdf(
                writer, signers.PdfSignatureMetadata(**meta_kwargs), signer=signer
            )
            with open(out_path, "wb") as outf:
                shutil.copyfileobj(signed, outf)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"签名失败: {exc}")
    finally:
        _cleanup(in_path, cert_path, key_path)

    base = (file.filename or "document.pdf").rsplit(".", 1)[0]
    return FileResponse(
        out_path,
        media_type="application/pdf",
        filename=f"{base}_signed.pdf"
    )


def _cleanup(*paths: pathlib.Path) -> None:
    for p in paths:
        try:
            p.unlink(missing_ok=True)
        except OSError:
            pass
