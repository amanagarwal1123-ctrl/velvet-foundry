"""Backend API tests for Factory App using public endpoint."""
import sys
import requests
from datetime import datetime

BASE_URL = "https://velvet-foundry--74m4978m.preview.emergentagent.com/api"
WS = "demo"
METAL = "silver"

class FactoryAPITester:
    def __init__(self):
        self.admin_token = None
        self.manager_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failures = []

    def test(self, name, condition, detail=""):
        """Run a test and track results."""
        self.tests_run += 1
        if condition:
            self.tests_passed += 1
            print(f"✅ PASS: {name}")
            return True
        else:
            self.failures.append(f"{name}: {detail}")
            print(f"❌ FAIL: {name} - {detail}")
            return False

    def hdr(self, token):
        """Auth header."""
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def test_admin_login(self):
        """Test admin login."""
        print("\n🔐 Testing Admin Login...")
        try:
            r = requests.post(f"{BASE_URL}/auth/login", json={"email": "admin@gmail.com", "password": "1803"}, timeout=10)
            if self.test("Admin login status", r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"):
                data = r.json()
                self.admin_token = data.get("token")
                self.test("Admin token received", bool(self.admin_token))
                self.test("Admin role correct", data.get("user", {}).get("role") == "admin")
                return True
        except Exception as e:
            self.test("Admin login", False, str(e))
        return False

    def test_otp_flow(self):
        """Test OTP code generation and login."""
        print("\n🔑 Testing OTP Code Flow...")
        if not self.admin_token:
            print("⚠️  Skipping OTP test - no admin token")
            return False
        
        try:
            # Create manager code
            r = requests.post(
                f"{BASE_URL}/codes",
                json={"name": "TEST_Manager", "role": "manager"},
                headers=self.hdr(self.admin_token),
                timeout=10
            )
            if self.test("Create manager code", r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"):
                code = r.json().get("code")
                self.test("Code is 6 digits", len(code) == 6 and code.isdigit())
                
                # Login with code
                r = requests.post(f"{BASE_URL}/auth/code-login", json={"code": code}, timeout=10)
                if self.test("Manager code login", r.status_code == 200, f"Got {r.status_code}"):
                    self.manager_token = r.json().get("token")
                    self.test("Manager token received", bool(self.manager_token))
                    
                    # Verify code is used (should fail on reuse)
                    r = requests.post(f"{BASE_URL}/auth/code-login", json={"code": code}, timeout=10)
                    self.test("Used code rejected", r.status_code == 401)
                    return True
        except Exception as e:
            self.test("OTP flow", False, str(e))
        return False

    def test_dashboard(self):
        """Test dashboard endpoint."""
        print("\n📊 Testing Dashboard...")
        if not self.admin_token:
            print("⚠️  Skipping dashboard test - no admin token")
            return False
        
        try:
            r = requests.get(
                f"{BASE_URL}/dashboard?workspace={WS}&metal={METAL}",
                headers=self.hdr(self.admin_token),
                timeout=10
            )
            if self.test("Dashboard loads", r.status_code == 200, f"Got {r.status_code}"):
                data = r.json()
                self.test("Dashboard has KPIs", "kpis" in data)
                self.test("Dashboard has recent_bags", "recent_bags" in data)
                return True
        except Exception as e:
            self.test("Dashboard", False, str(e))
        return False

    def test_steps(self):
        """Test steps endpoint."""
        print("\n📋 Testing Steps...")
        if not self.admin_token:
            print("⚠️  Skipping steps test - no admin token")
            return False
        
        try:
            r = requests.get(
                f"{BASE_URL}/steps?workspace={WS}",
                headers=self.hdr(self.admin_token),
                timeout=10
            )
            if self.test("Steps list loads", r.status_code == 200, f"Got {r.status_code}"):
                steps = r.json()
                self.test("Steps preloaded", len(steps) >= 5, f"Got {len(steps)} steps")
                if steps:
                    self.test("Step has name_hi", "name_hi" in steps[0])
                    self.test("Step has name_en", "name_en" in steps[0])
                return True
        except Exception as e:
            self.test("Steps", False, str(e))
        return False

    def test_bags_list(self):
        """Test bags listing."""
        print("\n👜 Testing Bags...")
        if not self.admin_token:
            print("⚠️  Skipping bags test - no admin token")
            return False
        
        try:
            r = requests.get(
                f"{BASE_URL}/bags?workspace={WS}&metal={METAL}",
                headers=self.hdr(self.admin_token),
                timeout=10
            )
            if self.test("Bags list loads", r.status_code == 200, f"Got {r.status_code}"):
                bags = r.json()
                self.test("Demo bags present", len(bags) >= 1, f"Got {len(bags)} bags")
                if bags:
                    self.test("Bag has summary", "summary" in bags[0])
                return True
        except Exception as e:
            self.test("Bags list", False, str(e))
        return False

    def test_packets_list(self):
        """Test packets listing."""
        print("\n📦 Testing Packets...")
        if not self.admin_token:
            print("⚠️  Skipping packets test - no admin token")
            return False
        
        try:
            r = requests.get(
                f"{BASE_URL}/packets?workspace={WS}&metal={METAL}",
                headers=self.hdr(self.admin_token),
                timeout=10
            )
            self.test("Packets list loads", r.status_code == 200, f"Got {r.status_code}")
            return r.status_code == 200
        except Exception as e:
            self.test("Packets list", False, str(e))
        return False

    def test_karigars(self):
        """Test karigars endpoint."""
        print("\n👷 Testing Karigars...")
        if not self.admin_token:
            print("⚠️  Skipping karigars test - no admin token")
            return False
        
        try:
            r = requests.get(
                f"{BASE_URL}/karigars?workspace={WS}",
                headers=self.hdr(self.admin_token),
                timeout=10
            )
            self.test("Karigars list loads", r.status_code == 200, f"Got {r.status_code}")
            return r.status_code == 200
        except Exception as e:
            self.test("Karigars", False, str(e))
        return False

    def test_settings(self):
        """Test settings endpoint."""
        print("\n⚙️  Testing Settings...")
        if not self.admin_token:
            print("⚠️  Skipping settings test - no admin token")
            return False
        
        try:
            r = requests.get(
                f"{BASE_URL}/settings?workspace={WS}",
                headers=self.hdr(self.admin_token),
                timeout=10
            )
            if self.test("Settings loads", r.status_code == 200, f"Got {r.status_code}"):
                data = r.json()
                self.test("Settings has labour_rates", "labour_rates" in data)
                return True
        except Exception as e:
            self.test("Settings", False, str(e))
        return False

    def run_all(self):
        """Run all tests."""
        print("=" * 60)
        print("🏭 Factory App Backend API Tests")
        print(f"📍 Endpoint: {BASE_URL}")
        print(f"🕐 Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)

        # Core auth tests
        if not self.test_admin_login():
            print("\n❌ Admin login failed - stopping tests")
            self.print_summary()
            return 1

        self.test_otp_flow()
        
        # Feature tests
        self.test_dashboard()
        self.test_steps()
        self.test_bags_list()
        self.test_packets_list()
        self.test_karigars()
        self.test_settings()

        self.print_summary()
        return 0 if self.tests_passed == self.tests_run else 1

    def print_summary(self):
        """Print test summary."""
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {len(self.failures)}")
        
        if self.failures:
            print("\n❌ Failures:")
            for f in self.failures:
                print(f"  • {f}")
        
        print("=" * 60)

def main():
    tester = FactoryAPITester()
    return tester.run_all()

if __name__ == "__main__":
    sys.exit(main())
