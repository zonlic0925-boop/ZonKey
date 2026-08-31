"""P3 安全工具端点测试：权限保护 + PAdES 签名（pyhanko）。"""

from __future__ import annotations

import io
import pathlib

import pikepdf
import pytest
from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

from server_bridge import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture()
def sample_pdf_bytes() -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(200, 120))
    c.drawString(20, 80, "P3 endpoint test")
    c.showPage()
    c.save()
    return buf.getvalue()


@pytest.fixture()
def pem_pair(tmp_path: pathlib.Path) -> tuple[pathlib.Path, pathlib.Path]:
    """自签证书+私钥（仅测试用）。"""
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID
    import datetime

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "P3 Test Cert")])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=365))
        .sign(key, hashes.SHA256())
    )
    cert_p = tmp_path / "t.crt.pem"
    key_p = tmp_path / "t.key.pem"
    cert_p.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_p.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    return cert_p, key_p


def test_protect_advanced_encrypted(client: TestClient, sample_pdf_bytes: bytes):
    r = client.post(
        "/api/convert/protect-advanced",
        files={"file": ("t.pdf", sample_pdf_bytes, "application/pdf")},
        data={
            "user_pw": "User123!",
            "owner_pw": "Owner123!",
            "allow_print": "true",
            "allow_copy": "false",
            "allow_modify": "false",
            "allow_fill": "true",
        },
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    out = pathlib.Path(r.headers["content-disposition"].split('"')[1] if '"' in r.headers["content-disposition"] else "protected.pdf")
    data = r.content
    tmp = pathlib.Path("tests/_protected_test.pdf")
    tmp.write_bytes(data)
    try:
        with pikepdf.open(tmp, password="User123!") as pdf:
            assert pdf.is_encrypted
            assert len(pdf.pages) == 1
            perms = pdf.allow
            assert not perms.extract  # allow_copy=false
    finally:
        tmp.unlink(missing_ok=True)


def test_sign_pades_real_signature(
    client: TestClient, sample_pdf_bytes: bytes, pem_pair: tuple[pathlib.Path, pathlib.Path]
):
    cert_p, key_p = pem_pair
    r = client.post(
        "/api/convert/sign-pades",
        files={
            "file": ("t.pdf", sample_pdf_bytes, "application/pdf"),
            "cert_pem": ("c.pem", cert_p.read_bytes(), "application/x-pem-file"),
            "key_pem": ("k.pem", key_p.read_bytes(), "application/x-pem-file"),
        },
        data={"key_pass": "", "reason": "pytest", "location": "test"},
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    tmp = pathlib.Path("tests/_signed_test.pdf")
    tmp.write_bytes(r.content)
    try:
        with pikepdf.open(tmp) as pdf:
            acro = pdf.Root.get("/AcroForm")
            assert acro is not None and len(acro["/Fields"]) >= 1
        # pyhanko 验签：INTACT（自签证书 UNTRUSTED 属预期）
        from pyhanko.pdf_utils.reader import PdfFileReader
        from pyhanko.sign.validation import validate_pdf_signature

        with open(tmp, "rb") as f:
            reader = PdfFileReader(f)
            sigs = list(reader.embedded_signatures)
            assert len(sigs) == 1
            status = validate_pdf_signature(sigs[0])
            assert "UNTOUCHED" in status.summary()
    finally:
        tmp.unlink(missing_ok=True)


def test_sign_pades_bad_key_rejected(
    client: TestClient, sample_pdf_bytes: bytes, pem_pair: tuple[pathlib.Path, pathlib.Path]
):
    cert_p, _ = pem_pair
    r = client.post(
        "/api/convert/sign-pades",
        files={
            "file": ("t.pdf", sample_pdf_bytes, "application/pdf"),
            "cert_pem": ("c.pem", cert_p.read_bytes(), "application/x-pem-file"),
            "key_pem": ("k.pem", b"not a key", "application/x-pem-file"),
        },
        data={"key_pass": ""},
    )
    assert r.status_code == 422
