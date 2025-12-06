import unittest
import sys
import os
import json

# Add parent directory to path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db, User, Address

class UserAddressTestCase(unittest.TestCase):
    def setUp(self):
        """Set up test client and in-memory database."""
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.app = app.test_client()
        
        self.ctx = app.app_context()
        self.ctx.push()
        
        db.create_all()
        
        # Create User
        self.user = User(name="Test User", email="user@test.com", role="user")
        self.user.set_password("password")
        db.session.add(self.user)
        db.session.commit()
        
        # Login to get token
        res = self.app.post('/api/auth/login', json={
            'email': 'user@test.com',
            'password': 'password'
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

    def test_add_address_success(self):
        payload = {
            'address_line_1': '123 Main St',
            'city': 'Tanjore',
            'state': 'TN',
            'postal_code': '613001',
            'country': 'India'
        }
        res = self.app.post('/api/user/addresses', data=json.dumps(payload), headers=self.headers)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['city'], 'Tanjore')
        
        # Verify DB
        addr = Address.query.first()
        self.assertIsNotNone(addr)
        self.assertEqual(addr.user_id, self.user.id)

    def test_get_addresses(self):
        # Add one manually
        addr = Address(user_id=self.user.id, address_line_1='Test', city='C', state='S', postal_code='000')
        db.session.add(addr)
        db.session.commit()
        
        res = self.app.get('/api/user/addresses', headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['city'], 'C')

    def test_delete_address(self):
        addr = Address(user_id=self.user.id, address_line_1='Del', city='C', state='S', postal_code='000')
        db.session.add(addr)
        db.session.commit()
        
        res = self.app.delete(f'/api/user/addresses/{addr.id}', headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(Address.query.get(addr.id))

    def test_delete_address_not_owned(self):
        # Create another user and address
        other = User(name="Other", email="other@test.com", role="user")
        other.set_password("p")
        db.session.add(other)
        db.session.commit()
        
        other_addr = Address(user_id=other.id, address_line_1='Other', city='O', state='O', postal_code='1')
        db.session.add(other_addr)
        db.session.commit()
        
        # Try to delete with first user's token
        res = self.app.delete(f'/api/user/addresses/{other_addr.id}', headers=self.headers)
        self.assertEqual(res.status_code, 404) # Should return 404 not found (filtered by user_id)

    def test_add_address_validation(self):
        payload = { 'city': 'No Line 1' }
        res = self.app.post('/api/user/addresses', data=json.dumps(payload), headers=self.headers)
        self.assertEqual(res.status_code, 400)

if __name__ == '__main__':
    unittest.main()
