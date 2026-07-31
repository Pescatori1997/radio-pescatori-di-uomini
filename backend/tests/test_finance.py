"""Backend tests for the Trasparenza Economica (Finance) admin section.

Covers:
- Entries CRUD (POST/PUT/DELETE) with validation
- Summary (balance, month totals, offerings, monthly array)
- Ledger with running balance
- Decisions CRUD
- Audit log immutability + fields
- Filters
- RBAC (super admin allowlist / administrator / collaborator+finance / listener)
- Auto-registration idempotency (record_auto_income) via direct DB check
"""

import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://evangelic-stream.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

SUPER_ADMIN_EMAIL = "pescatoridiuomini@outlook.it"
SUPER_ADMIN_PWD = "AdminTestPwd1!"

TIMEOUT = 30


# ------------------------------------------------------------------ helpers ---
def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _register_listener(prefix="listener"):
    email = f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    # /auth/register is rate-limited (5/min per IP). Retry with backoff.
    last = None
    for attempt in range(6):
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "Test1234!", "name": f"Test {prefix}"},
                          timeout=TIMEOUT)
        last = r
        if r.status_code == 200:
            data = r.json()
            return {"token": data["token"], "user_id": data["user"]["user_id"], "email": email}
        if r.status_code == 429:
            time.sleep(12 + attempt * 3)
            continue
        break
    raise AssertionError(f"register {email} -> {last.status_code}: {last.text}")


# ------------------------------------------------------------------ fixtures --
@pytest.fixture(scope="module")
def super_admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PWD},
                      timeout=TIMEOUT)
    if r.status_code != 200:
        pytest.skip(f"Super admin login failed: {r.status_code} {r.text}")
    j = r.json()
    assert j["user"]["role"] == "administrator", j
    return j["token"]


@pytest.fixture(scope="module")
def listener_ctx():
    """A normal listener (no finance perm)."""
    return _register_listener("listener")


@pytest.fixture(scope="module")
def collab_finance_ctx(super_admin_token):
    """A collaborator user granted the 'finance' permission (read-only via RBAC)."""
    ctx = _register_listener("collabfin")
    r = requests.put(
        f"{API}/admin/users/{ctx['user_id']}/role",
        headers=_hdr(super_admin_token),
        json={"role": "collaborator", "permissions": ["finance"]},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"assign collab role failed: {r.status_code} {r.text}"
    # Re-login to pick up new role/permissions in the session/user record
    r2 = requests.post(f"{API}/auth/login",
                       json={"email": ctx["email"], "password": "Test1234!"},
                       timeout=TIMEOUT)
    assert r2.status_code == 200
    ctx["token"] = r2.json()["token"]
    assert r2.json()["user"]["role"] == "collaborator"
    assert "finance" in (r2.json()["user"].get("permissions") or [])
    return ctx


@pytest.fixture(scope="module")
def collab_no_finance_ctx(super_admin_token):
    """A collaborator WITHOUT finance permission."""
    ctx = _register_listener("collabnone")
    r = requests.put(
        f"{API}/admin/users/{ctx['user_id']}/role",
        headers=_hdr(super_admin_token),
        json={"role": "collaborator", "permissions": ["news"]},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200
    r2 = requests.post(f"{API}/auth/login",
                       json={"email": ctx["email"], "password": "Test1234!"},
                       timeout=TIMEOUT)
    ctx["token"] = r2.json()["token"]
    return ctx


@pytest.fixture(scope="module")
def created_ids():
    """Track ids created during tests so we can clean up at teardown."""
    d = {"entries": [], "decisions": []}
    yield d
    # teardown handled explicitly in a final test to reuse the fixture chain
    # cleanup relies on the tests themselves (delete tests remove ids); leftover
    # ids are cleaned up here as a safety net.


@pytest.fixture(scope="module", autouse=False)
def _cleanup(request, super_admin_token, created_ids):
    yield
    for eid in list(created_ids["entries"]):
        requests.delete(f"{API}/admin/finance/entries/{eid}",
                        headers=_hdr(super_admin_token), timeout=TIMEOUT)
    for did in list(created_ids["decisions"]):
        requests.delete(f"{API}/admin/finance/decisions/{did}",
                        headers=_hdr(super_admin_token), timeout=TIMEOUT)


# ------------------------------------------------------------------ tests -----
class TestHealth:
    def test_base_reachable(self):
        r = requests.get(f"{API}/", timeout=TIMEOUT)
        assert r.status_code in (200, 404, 401)


class TestRBAC:
    def test_listener_summary_forbidden(self, listener_ctx):
        r = requests.get(f"{API}/admin/finance/summary",
                         headers=_hdr(listener_ctx["token"]), timeout=TIMEOUT)
        assert r.status_code == 403, r.text

    def test_listener_entries_forbidden(self, listener_ctx):
        r = requests.get(f"{API}/admin/finance/entries",
                         headers=_hdr(listener_ctx["token"]), timeout=TIMEOUT)
        assert r.status_code == 403

    def test_listener_audit_forbidden(self, listener_ctx):
        r = requests.get(f"{API}/admin/finance/audit",
                         headers=_hdr(listener_ctx["token"]), timeout=TIMEOUT)
        assert r.status_code == 403

    def test_collab_no_finance_forbidden(self, collab_no_finance_ctx):
        r = requests.get(f"{API}/admin/finance/summary",
                         headers=_hdr(collab_no_finance_ctx["token"]), timeout=TIMEOUT)
        assert r.status_code == 403

    def test_collab_finance_can_read_summary(self, collab_finance_ctx):
        r = requests.get(f"{API}/admin/finance/summary",
                         headers=_hdr(collab_finance_ctx["token"]), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        for k in ("balance", "month_income", "month_expense", "total_offerings",
                  "total_income", "total_expense", "monthly"):
            assert k in r.json()

    def test_collab_finance_can_read_entries(self, collab_finance_ctx):
        r = requests.get(f"{API}/admin/finance/entries",
                         headers=_hdr(collab_finance_ctx["token"]), timeout=TIMEOUT)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_collab_finance_cannot_create_entry(self, collab_finance_ctx):
        payload = {"type": "income", "date": "2026-01-15", "description": "TEST collab write",
                   "category": "Donazione", "amount": 10.0}
        r = requests.post(f"{API}/admin/finance/entries",
                          headers=_hdr(collab_finance_ctx["token"]),
                          json=payload, timeout=TIMEOUT)
        assert r.status_code == 403, r.text

    def test_collab_finance_cannot_delete(self, collab_finance_ctx):
        r = requests.delete(f"{API}/admin/finance/entries/fin_doesnotexist",
                            headers=_hdr(collab_finance_ctx["token"]), timeout=TIMEOUT)
        assert r.status_code == 403

    def test_collab_finance_cannot_read_audit(self, collab_finance_ctx):
        # Only the super admin (allowlist email) can read the audit log
        r = requests.get(f"{API}/admin/finance/audit",
                         headers=_hdr(collab_finance_ctx["token"]), timeout=TIMEOUT)
        assert r.status_code == 403, r.text


class TestEntries:
    def test_create_income_and_audit(self, super_admin_token, created_ids):
        payload = {"type": "income", "date": "2026-01-15",
                   "description": "TEST offerta sito", "category": "Offerta dal sito",
                   "amount": 25.5, "payment_method": "Carta (Stripe)",
                   "source": "Sito", "notes": "TEST"}
        r = requests.post(f"{API}/admin/finance/entries",
                          headers=_hdr(super_admin_token), json=payload, timeout=TIMEOUT)
        assert r.status_code == 201, r.text
        eid = r.json()["id"]
        created_ids["entries"].append(eid)

        # Verify via GET list that it was persisted
        rl = requests.get(f"{API}/admin/finance/entries?type=income",
                          headers=_hdr(super_admin_token), timeout=TIMEOUT)
        assert rl.status_code == 200
        assert any(e["id"] == eid and e["amount"] == 25.5 for e in rl.json())

        # Verify audit contains a "create" record for this entry
        ra = requests.get(f"{API}/admin/finance/audit",
                          headers=_hdr(super_admin_token), timeout=TIMEOUT)
        assert ra.status_code == 200
        recs = [x for x in ra.json() if x.get("record_id") == eid and x.get("operation") == "create"]
        assert recs, "No create audit record found"
        rec = recs[0]
        for f in ("at", "user_name", "operation", "section", "record_id", "before", "after", "ip"):
            assert f in rec, f"audit rec missing field {f}: {rec}"
        assert rec["section"] == "entry"
        assert rec["before"] is None
        assert rec["after"] and rec["after"]["amount"] == 25.5

    def test_create_expense(self, super_admin_token, created_ids):
        payload = {"type": "expense", "date": "2026-01-10",
                   "description": "TEST hosting bill", "category": "Hosting",
                   "amount": 12.0, "paid_by": "Admin", "notes": "TEST"}
        r = requests.post(f"{API}/admin/finance/entries",
                          headers=_hdr(super_admin_token), json=payload, timeout=TIMEOUT)
        assert r.status_code == 201, r.text
        created_ids["entries"].append(r.json()["id"])

    def test_invalid_category(self, super_admin_token):
        r = requests.post(f"{API}/admin/finance/entries",
                          headers=_hdr(super_admin_token),
                          json={"type": "income", "date": "2026-01-15",
                                "description": "TEST bad cat",
                                "category": "NotARealCategory", "amount": 1.0},
                          timeout=TIMEOUT)
        assert r.status_code == 400

    def test_invalid_amount_zero(self, super_admin_token):
        r = requests.post(f"{API}/admin/finance/entries",
                          headers=_hdr(super_admin_token),
                          json={"type": "income", "date": "2026-01-15",
                                "description": "TEST bad amount",
                                "category": "Donazione", "amount": 0},
                          timeout=TIMEOUT)
        assert r.status_code == 400

    def test_invalid_amount_negative(self, super_admin_token):
        r = requests.post(f"{API}/admin/finance/entries",
                          headers=_hdr(super_admin_token),
                          json={"type": "income", "date": "2026-01-15",
                                "description": "TEST neg",
                                "category": "Donazione", "amount": -5},
                          timeout=TIMEOUT)
        assert r.status_code == 400

    def test_update_creates_audit_update(self, super_admin_token, created_ids):
        # create then update
        r = requests.post(f"{API}/admin/finance/entries",
                          headers=_hdr(super_admin_token),
                          json={"type": "income", "date": "2026-01-05",
                                "description": "TEST to update",
                                "category": "Donazione", "amount": 5.0},
                          timeout=TIMEOUT)
        assert r.status_code == 201, r.text
        eid = r.json()["id"]
        created_ids["entries"].append(eid)

        ru = requests.put(f"{API}/admin/finance/entries/{eid}",
                         headers=_hdr(super_admin_token),
                         json={"type": "income", "date": "2026-01-05",
                               "description": "TEST updated desc",
                               "category": "Donazione", "amount": 9.99},
                         timeout=TIMEOUT)
        assert ru.status_code == 200, ru.text

        # verify persisted
        rl = requests.get(f"{API}/admin/finance/entries?q=TEST updated",
                          headers=_hdr(super_admin_token), timeout=TIMEOUT)
        assert any(e["id"] == eid and e["amount"] == 9.99 for e in rl.json())

        # audit update record
        ra = requests.get(f"{API}/admin/finance/audit",
                          headers=_hdr(super_admin_token), timeout=TIMEOUT)
        upd = [x for x in ra.json() if x["record_id"] == eid and x["operation"] == "update"]
        assert upd, "No update audit record"
        assert upd[0]["before"]["amount"] == 5.0
        assert upd[0]["after"]["amount"] == 9.99

    def test_delete_creates_audit_delete(self, super_admin_token, created_ids):
        r = requests.post(f"{API}/admin/finance/entries",
                          headers=_hdr(super_admin_token),
                          json={"type": "expense", "date": "2026-01-06",
                                "description": "TEST to delete",
                                "category": "Software", "amount": 3.0},
                          timeout=TIMEOUT)
        assert r.status_code == 201
        eid = r.json()["id"]

        rd = requests.delete(f"{API}/admin/finance/entries/{eid}",
                             headers=_hdr(super_admin_token), timeout=TIMEOUT)
        assert rd.status_code == 200

        # confirm gone
        rl = requests.get(f"{API}/admin/finance/entries?q=TEST to delete",
                          headers=_hdr(super_admin_token), timeout=TIMEOUT)
        assert not any(e["id"] == eid for e in rl.json())

        # audit delete
        ra = requests.get(f"{API}/admin/finance/audit",
                          headers=_hdr(super_admin_token), timeout=TIMEOUT)
        dels = [x for x in ra.json() if x["record_id"] == eid and x["operation"] == "delete"]
        assert dels
        assert dels[0]["after"] is None
        assert dels[0]["before"] and dels[0]["before"]["amount"] == 3.0


class TestSummaryAndLedger:
    def test_summary_math(self, super_admin_token):
        r = requests.get(f"{API}/admin/finance/summary",
                         headers=_hdr(super_admin_token), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        s = r.json()
        assert isinstance(s["monthly"], list) and len(s["monthly"]) == 12
        # each monthly item must have month/income/expense
        for m in s["monthly"]:
            assert set(m.keys()) >= {"month", "income", "expense"}
        # balance == total_income - total_expense (within cent rounding)
        assert abs(s["balance"] - (s["total_income"] - s["total_expense"])) < 0.02

        # total_offerings must be <= total_income and only counts allowlist categories
        assert s["total_offerings"] <= s["total_income"] + 0.01

    def test_current_month_totals(self, super_admin_token, created_ids):
        # add unique income + expense in current month, then re-check
        now = datetime.now(timezone.utc)
        today = now.date().isoformat()
        s0 = requests.get(f"{API}/admin/finance/summary",
                          headers=_hdr(super_admin_token), timeout=TIMEOUT).json()

        r1 = requests.post(f"{API}/admin/finance/entries",
                          headers=_hdr(super_admin_token),
                          json={"type": "income", "date": today,
                                "description": "TEST month inc",
                                "category": "Offerta dal sito", "amount": 7.77},
                          timeout=TIMEOUT)
        assert r1.status_code == 201
        created_ids["entries"].append(r1.json()["id"])

        r2 = requests.post(f"{API}/admin/finance/entries",
                          headers=_hdr(super_admin_token),
                          json={"type": "expense", "date": today,
                                "description": "TEST month exp",
                                "category": "Dominio", "amount": 2.22},
                          timeout=TIMEOUT)
        assert r2.status_code == 201
        created_ids["entries"].append(r2.json()["id"])

        s1 = requests.get(f"{API}/admin/finance/summary",
                          headers=_hdr(super_admin_token), timeout=TIMEOUT).json()
        # If the current month is actually in scope (server_now month matches today),
        # deltas should reflect the new entries. Use tolerance for concurrent writes.
        d_inc = round(s1["month_income"] - s0["month_income"], 2)
        d_exp = round(s1["month_expense"] - s0["month_expense"], 2)
        assert d_inc >= 7.77 - 0.01, f"expected month_income delta >= 7.77, got {d_inc}"
        assert d_exp >= 2.22 - 0.01, f"expected month_expense delta >= 2.22, got {d_exp}"

        # offerings must reflect the +7.77 Offerta dal sito
        d_off = round(s1["total_offerings"] - s0["total_offerings"], 2)
        assert d_off >= 7.77 - 0.01

    def test_ledger_running_balance(self, super_admin_token, created_ids):
        # create a couple of known entries and verify balance accumulates.
        # ledger is sorted asc chronologically then reversed => most-recent first.
        r = requests.get(f"{API}/admin/finance/ledger",
                         headers=_hdr(super_admin_token), timeout=TIMEOUT)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        # Every row must have a numeric 'balance'
        for row in rows:
            assert "balance" in row
            assert isinstance(row["balance"], (int, float))

        # Recompute chronologically to verify accumulation logic
        if rows:
            asc = list(reversed(rows))
            running = 0.0
            for row in asc:
                delta = row["amount"] if row["type"] == "income" else -row["amount"]
                running = round(running + delta, 2)
                assert abs(row["balance"] - running) < 0.02, \
                    f"balance mismatch: expected {running}, got {row['balance']}"


class TestFilters:
    @pytest.fixture(scope="class")
    def seeded(self, super_admin_token, created_ids):
        # Distinct filter probe: unique amount+description
        marker = f"TESTFILTER_{uuid.uuid4().hex[:6]}"
        ids = {}
        for payload in [
            {"type": "income", "date": "2024-06-15", "description": f"{marker} inc A",
             "category": "Donazione", "amount": 111.11},
            {"type": "income", "date": "2024-07-15", "description": f"{marker} inc B",
             "category": "Offerta dal sito", "amount": 222.22},
            {"type": "expense", "date": "2024-06-20", "description": f"{marker} exp C",
             "category": "Hosting", "amount": 333.33},
        ]:
            rr = requests.post(f"{API}/admin/finance/entries",
                               headers=_hdr(super_admin_token), json=payload, timeout=TIMEOUT)
            assert rr.status_code == 201
            eid = rr.json()["id"]
            created_ids["entries"].append(eid)
            ids[payload["description"]] = eid
        return {"marker": marker, "ids": ids}

    def test_filter_type(self, super_admin_token, seeded):
        r = requests.get(f"{API}/admin/finance/entries?type=expense&q={seeded['marker']}",
                         headers=_hdr(super_admin_token), timeout=TIMEOUT)
        rows = r.json()
        assert all(x["type"] == "expense" for x in rows)
        assert any("exp C" in x["description"] for x in rows)
        assert not any("inc A" in x["description"] for x in rows)

    def test_filter_category(self, super_admin_token, seeded):
        r = requests.get(f"{API}/admin/finance/entries?category=Offerta dal sito&q={seeded['marker']}",
                         headers=_hdr(super_admin_token), timeout=TIMEOUT)
        rows = r.json()
        assert all(x["category"] == "Offerta dal sito" for x in rows)
        assert any("inc B" in x["description"] for x in rows)

    def test_filter_year_month(self, super_admin_token, seeded):
        r = requests.get(f"{API}/admin/finance/entries?year=2024&month=6&q={seeded['marker']}",
                         headers=_hdr(super_admin_token), timeout=TIMEOUT)
        rows = r.json()
        assert all(x["date"].startswith("2024-06") for x in rows)
        # includes inc A + exp C, excludes inc B (2024-07)
        assert any("inc A" in x["description"] for x in rows)
        assert not any("inc B" in x["description"] for x in rows)

    def test_filter_amount_range(self, super_admin_token, seeded):
        r = requests.get(f"{API}/admin/finance/entries?min_amount=200&max_amount=250&q={seeded['marker']}",
                         headers=_hdr(super_admin_token), timeout=TIMEOUT)
        rows = r.json()
        assert all(200 <= x["amount"] <= 250 for x in rows)
        assert any(abs(x["amount"] - 222.22) < 0.01 for x in rows)

    def test_filter_q_text(self, super_admin_token, seeded):
        r = requests.get(f"{API}/admin/finance/entries?q={seeded['marker']} inc A",
                         headers=_hdr(super_admin_token), timeout=TIMEOUT)
        rows = r.json()
        assert any("inc A" in x["description"] for x in rows)


class TestDecisions:
    def test_decision_crud_and_audit(self, super_admin_token, created_ids):
        payload = {"date": "2026-01-01", "title": "TEST decision",
                   "description": "TEST desc"}
        r = requests.post(f"{API}/admin/finance/decisions",
                          headers=_hdr(super_admin_token), json=payload, timeout=TIMEOUT)
        assert r.status_code == 201, r.text
        did = r.json()["id"]
        created_ids["decisions"].append(did)

        # verify persisted
        rl = requests.get(f"{API}/admin/finance/decisions",
                          headers=_hdr(super_admin_token), timeout=TIMEOUT)
        assert any(d["id"] == did for d in rl.json())

        # update
        ru = requests.put(f"{API}/admin/finance/decisions/{did}",
                         headers=_hdr(super_admin_token),
                         json={"date": "2026-01-01", "title": "TEST decision v2",
                               "description": "TEST desc updated"},
                         timeout=TIMEOUT)
        assert ru.status_code == 200

        # audit for decision must have section=decision
        ra = requests.get(f"{API}/admin/finance/audit",
                          headers=_hdr(super_admin_token), timeout=TIMEOUT)
        assert ra.status_code == 200
        for op in ("create", "update"):
            recs = [x for x in ra.json() if x["record_id"] == did and x["operation"] == op]
            assert recs, f"missing audit {op} for decision {did}"
            assert recs[0]["section"] == "decision"

        # delete
        rd = requests.delete(f"{API}/admin/finance/decisions/{did}",
                             headers=_hdr(super_admin_token), timeout=TIMEOUT)
        assert rd.status_code == 200
        created_ids["decisions"].remove(did)

        ra2 = requests.get(f"{API}/admin/finance/audit",
                          headers=_hdr(super_admin_token), timeout=TIMEOUT)
        dels = [x for x in ra2.json() if x["record_id"] == did and x["operation"] == "delete"]
        assert dels and dels[0]["section"] == "decision"


class TestAuditImmutability:
    def test_audit_has_no_write_endpoints(self, super_admin_token):
        # No POST/PUT/DELETE for /admin/finance/audit should exist.
        for method in ("post", "put", "delete", "patch"):
            r = getattr(requests, method)(f"{API}/admin/finance/audit",
                                          headers=_hdr(super_admin_token),
                                          json={} if method != "delete" else None,
                                          timeout=TIMEOUT)
            # 405 (method not allowed) or 404 both acceptable, must not be 200/2xx
            assert r.status_code >= 400, f"{method.upper()} /admin/finance/audit unexpectedly returned {r.status_code}"
            # 200/201/204 would indicate a mutation endpoint exists
            assert r.status_code not in (200, 201, 204)

    def test_audit_delete_by_id_not_allowed(self, super_admin_token):
        r = requests.delete(f"{API}/admin/finance/audit/anything",
                            headers=_hdr(super_admin_token), timeout=TIMEOUT)
        assert r.status_code in (404, 405), r.status_code


class TestAutoIncomeIdempotency:
    """Logical/idempotency check for record_auto_income.

    We can't drive a real Stripe payment in tests. Instead we call the internal
    helper directly against the same DB via a small in-process script so we
    verify:
      * first call inserts a finance income keyed by ref
      * second call with the same ref does NOT duplicate
    """

    def test_direct_helper_idempotent(self, super_admin_token):
        import subprocess
        # Run helper in a subprocess with a fresh event loop + fresh motor
        # client injected into server.db to avoid cross-loop binding issues.
        code = r"""
import asyncio, os, sys
sys.path.insert(0, "/app/backend")

async def main():
    from motor.motor_asyncio import AsyncIOMotorClient
    import server
    # Re-bind server.db to a motor client running on THIS loop
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    server.db = client[db_name]

    ref = "TEST_AUTO_" + os.urandom(4).hex()
    await server.record_auto_income(ref=ref, amount=12.34, category="Donazione",
                                    description="TEST auto donation", source="Donazione dal sito")
    n1 = await server.db.finance_entries.count_documents({"ref": ref, "auto": True})
    await server.record_auto_income(ref=ref, amount=12.34, category="Donazione",
                                    description="TEST auto donation", source="Donazione dal sito")
    n2 = await server.db.finance_entries.count_documents({"ref": ref, "auto": True})
    ref2 = "TEST_AUTO_ZERO_" + os.urandom(4).hex()
    await server.record_auto_income(ref=ref2, amount=0, category="Donazione",
                                    description="TEST zero", source="Donazione dal sito")
    n3 = await server.db.finance_entries.count_documents({"ref": ref2})
    await server.db.finance_entries.delete_many({"ref": {"$in": [ref, ref2]}})
    print({"n1": n1, "n2": n2, "n3": n3})

asyncio.run(main())
"""
        # Load MONGO_URL/DB_NAME from backend .env so subprocess has them
        env = os.environ.copy()
        try:
            with open("/app/backend/.env") as fh:
                for line in fh:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    env.setdefault(k, v.strip().strip('"').strip("'"))
        except FileNotFoundError:
            pass
        proc = subprocess.run(["python", "-c", code], capture_output=True, text=True, timeout=45, env=env)
        assert proc.returncode == 0, f"stdout={proc.stdout}\nstderr={proc.stderr}"
        out_line = proc.stdout.strip().splitlines()[-1]
        # simple dict parse
        data = eval(out_line)  # noqa: S307 - trusted output from our script
        assert data["n1"] == 1, f"first insert did not create record: {data}"
        assert data["n2"] == 1, f"second call duplicated record: {data}"
        assert data["n3"] == 0, f"amount<=0 must not insert: {data}"


class TestCleanup:
    """Final cleanup for anything the tests created that wasn't already deleted."""

    def test_cleanup_created(self, super_admin_token, created_ids):
        for eid in list(created_ids["entries"]):
            requests.delete(f"{API}/admin/finance/entries/{eid}",
                            headers=_hdr(super_admin_token), timeout=TIMEOUT)
        for did in list(created_ids["decisions"]):
            requests.delete(f"{API}/admin/finance/decisions/{did}",
                            headers=_hdr(super_admin_token), timeout=TIMEOUT)
        created_ids["entries"].clear()
        created_ids["decisions"].clear()

    def test_cleanup_users(self, super_admin_token, listener_ctx, collab_finance_ctx, collab_no_finance_ctx):
        for ctx in (listener_ctx, collab_finance_ctx, collab_no_finance_ctx):
            requests.delete(f"{API}/admin/users/{ctx['user_id']}",
                            headers=_hdr(super_admin_token), timeout=TIMEOUT)
