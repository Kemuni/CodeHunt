from app.main import app
from app.models import TaskComplication


def test_template_contract_has_no_slug():
    schemas = app.openapi()["components"]["schemas"]
    for name in ("TemplateCreate", "TemplateUpdate", "TemplateRead"):
        assert "slug" not in schemas[name]["properties"]
        assert "slug" not in schemas[name].get("required", [])
    assert "slug" not in TaskComplication.__table__.columns
    assert "slug" in schemas["TaskRead"]["properties"]
