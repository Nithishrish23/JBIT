import unittest
import sys
import os
import json

# Add parent directory to path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db, User, Category, Product, Inventory

class AdminAddTestCase(unittest.TestCase):
    def setUp(self):
        """Set up test client and in-memory database."""
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.app = app.test_client()
        
        self.ctx = app.app_context()
        self.ctx.push()
        
        db.create_all()
        
        # Create Admin User
        self.admin = User(name="Admin", email="admin@test.com", role="admin")
        self.admin.set_password("adminpass")
        db.session.add(self.admin)
        
        # Create a category for product tests
        cat = Category(name="Test Cat", slug="test-cat")
        db.session.add(cat)
        
        db.session.commit()
        self.cat_id = cat.id
        
        # Login as Admin to get token
        res = self.app.post('/api/auth/login', json={
            'email': 'admin@test.com',
            'password': 'adminpass'
        })
        self.token = res.get_json()['access_token']
        self.headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }

    def tearDown(self):
        """Clean up database."""
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    # ----------------------------------------------------------------
    # Test: POST /api/admin/users
    # ----------------------------------------------------------------
    def test_add_user_success(self):
        payload = {
            'name': 'New User',
            'email': 'newuser@test.com',
            'password': 'userpass',
            'role': 'user'
        }
        res = self.app.post('/api/admin/users', data=json.dumps(payload), headers=self.headers)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['email'], 'newuser@test.com')
        self.assertEqual(data['role'], 'user')

    def test_add_user_missing_fields(self):
        payload = {'name': 'Incomplete'} # Missing email, password
        res = self.app.post('/api/admin/users', data=json.dumps(payload), headers=self.headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn('Missing required fields', res.get_json()['error'])

    def test_add_user_duplicate_email(self):
        # Create user first
        u = User(name="Existing", email="dup@test.com", role="user")
        u.set_password("pass")
        db.session.add(u)
        db.session.commit()

        payload = {
            'name': 'Duplicate',
            'email': 'dup@test.com',
            'password': 'pass'
        }
        res = self.app.post('/api/admin/users', data=json.dumps(payload), headers=self.headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn('Email already exists', res.get_json()['error'])

    def test_add_user_invalid_role(self):
        payload = {
            'name': 'RoleTest',
            'email': 'role@test.com',
            'password': 'pass',
            'role': 'supergod'
        }
        res = self.app.post('/api/admin/users', data=json.dumps(payload), headers=self.headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn('Invalid role', res.get_json()['error'])

    # ----------------------------------------------------------------
    # Test: POST /api/admin/sellers
    # ----------------------------------------------------------------
    def test_add_seller_success(self):
        payload = {
            'name': 'New Seller',
            'email': 'newseller@test.com',
            'password': 'pass'
        }
        res = self.app.post('/api/admin/sellers', data=json.dumps(payload), headers=self.headers)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['role'], 'seller')
        self.assertTrue(data['is_approved'])

    def test_add_seller_duplicate(self):
        # Admin is already a user with email admin@test.com
        payload = {
            'name': 'Admin Copy',
            'email': 'admin@test.com',
            'password': 'pass'
        }
        res = self.app.post('/api/admin/sellers', data=json.dumps(payload), headers=self.headers)
        self.assertEqual(res.status_code, 400)

    # ----------------------------------------------------------------
    # Test: POST /api/admin/products
    # ----------------------------------------------------------------
    def test_add_product_success(self):
        # Need a seller first
        seller = User(name="Seller", email="s@s.com", role="seller", is_approved=True)
        seller.set_password("p")
        db.session.add(seller)
        db.session.commit()
        seller_id = seller.id
        cat_id = self.cat_id

        payload = {
            'seller_id': seller_id,
            'category_id': cat_id,
            'name': 'New Product',
            'description': 'Desc',
            'price': 99.99,
            'stock_qty': 50
        }
        res = self.app.post('/api/admin/products', data=json.dumps(payload), headers=self.headers)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['name'], 'New Product')
        self.assertEqual(data['price'], 99.99)
        self.assertEqual(data['stock_qty'], 50)
        self.assertTrue(data['is_approved'])

    def test_add_product_invalid_relationships(self):
        payload = {
            'seller_id': 99999, # Non-existent
            'category_id': 99999,
            'name': 'Ghost Product',
            'price': 10
        }
        res = self.app.post('/api/admin/products', data=json.dumps(payload), headers=self.headers)
        self.assertEqual(res.status_code, 400)
        # Should fail on seller check first
        self.assertIn('Seller not found', res.get_json()['error'])

    def test_add_product_negative_numbers(self):
        # Valid seller needed to pass first check
        seller = User(name="Seller2", email="s2@s.com", role="seller", is_approved=True)
        seller.set_password("p")
        db.session.add(seller)
        db.session.commit()
        seller_id = seller.id

        # Negative Price
        payload = {
            'seller_id': seller_id,
            'category_id': self.cat_id,
            'name': 'Bad Price',
            'price': -5
        }
        res = self.app.post('/api/admin/products', data=json.dumps(payload), headers=self.headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn('Price cannot be negative', res.get_json()['error'])

        # Negative Stock
        payload['price'] = 10
        payload['stock_qty'] = -1
        res = self.app.post('/api/admin/products', data=json.dumps(payload), headers=self.headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn('Stock cannot be negative', res.get_json()['error'])

    def test_add_product_transaction_integrity(self):
        pass

if __name__ == '__main__':
    unittest.main()
