"""Tests for Sales & Marketing Intelligence service and API endpoints."""
import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.config import settings


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "resolved_engine", "rules")
    with TestClient(app) as c:
        yield c


def test_merchants_list(client):
    merchants = client.get("/api/merchants").json()
    assert isinstance(merchants, list)
    assert "Sharma Kirana Store" in merchants
    assert "Croma Electronics" in merchants


def test_sales_overview_and_analysis(client):
    # Overview for all merchants
    overview = client.get("/api/sales/overview").json()
    assert overview["total_orders"] > 0
    assert overview["gross_sales_paise"] > 0
    assert len(overview["categories"]) > 0

    # Overview for specific merchant
    store_sales = client.get("/api/sales/overview?merchant=Sharma%20Kirana%20Store").json()
    assert store_sales["merchant"] == "Sharma Kirana Store"
    assert store_sales["total_orders"] > 0

    # Sales analysis endpoint
    analysis = client.post(
        "/api/sales/analyze",
        json={"merchant": "Sharma Kirana Store", "prompt": "Identify checkout revenue drop-offs"},
    ).json()
    assert "report_title" in analysis
    assert "executive_summary" in analysis
    assert len(analysis["findings"]) > 0
    assert len(analysis["recommendations"]) > 0
    assert len(analysis["agent_trace"]) > 0


def test_marketing_overview_and_analysis(client):
    # Overview for all merchants
    mkt = client.get("/api/marketing/overview").json()
    assert mkt["total_spend_paise"] > 0
    assert mkt["blended_roas"] > 0
    assert len(mkt["campaigns"]) > 0

    # Specific merchant marketing audit
    audit = client.post(
        "/api/marketing/analyze",
        json={"merchant": "Sharma Kirana Store", "prompt": "Audit TV vs Meta ads for Gen Z"},
    ).json()
    assert "Marketing ROI" in audit["report_title"]
    assert "budget_reallocation_simulation" in audit
    sim = audit["budget_reallocation_simulation"]
    assert sim["revenue_growth_pct"] > 0
    assert len(sim["shifts"]) >= 2
    assert any("Meta" in s["to_channel"] for s in sim["shifts"])
    assert any("TV" in s["from_channel"] for s in sim["shifts"])
