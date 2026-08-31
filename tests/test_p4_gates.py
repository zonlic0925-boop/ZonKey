"""P4 release gates: cleanup endpoints + convert capability."""

from __future__ import annotations

from fastapi.testclient import TestClient

from server_bridge import app


def _client() -> TestClient:
    return TestClient(app)


def test_cleanup_status_structure():
    r = _client().get("/api/system/cleanup/status")
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") == "ok"
    dirs = body.get("dirs") or {}
    assert {"temp_bridge_files", "output"}.issubset(dirs.keys())
    for key in ("temp_bridge_files", "output"):
        entry = dirs[key]
        assert "path" in entry
        assert "files" in entry
        assert "bytes" in entry


def test_cleanup_post_success():
    r = _client().post("/api/system/cleanup")
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") == "success"
    assert "cleaned_files" in body
    assert "cleaned_bytes" in body


def test_convert_capability_gate():
    r = _client().get("/api/convert/capability")
    assert r.status_code == 200
    data = r.json()
    for key in ("engines", "pywin32", "word_com", "excel_com", "rapidocr"):
        assert key in data
