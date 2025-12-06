import unittest
from unittest.mock import patch, MagicMock
import json
import os
import sys

# Mocking the ai_service module before importing app
sys.modules['ai_service'] = MagicMock()

# Now we can import app
from app import app, db, User, Product, Category

class AIIntegrationTestCase(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        app.config['JWT_SECRET_KEY'] = 'test-secret'
        self.app = app.test_client()
        
        with app.app_context():
            db.create_all()
            # Create dummy user and product
            seller = User(name='seller', email='seller@test.com', role='seller', is_approved=True, is_active=True)
            seller.set_password('password')
            db.session.add(seller)
            db.session.commit()
            
            cat = Category(name='Test Cat', slug='test-cat')
            db.session.add(cat)
            db.session.commit()
            
            p1 = Product(name='Mango', description='Fresh mango', price=10, seller_id=seller.id, category_id=cat.id, status='approved')
            p2 = Product(name='Apple', description='Red apple', price=5, seller_id=seller.id, category_id=cat.id, status='approved')
            db.session.add(p1)
            db.session.add(p2)
            db.session.commit()
            self.p1_id = p1.id
            self.p2_id = p2.id

    def get_auth_header(self):
        response = self.app.post('/api/auth/login', json={
            'email': 'seller@test.com',
            'password': 'password'
        })
        if response.status_code != 200:
             raise Exception(f"Login failed: {response.data}")
        token = json.loads(response.data)['access_token']
        return {'Authorization': f'Bearer {token}'}

    def tearDown(self):
        with app.app_context():
            db.session.remove()
            db.drop_all()

    def test_suggest_product(self):
        # Mock the return value of generate_product_suggestions
        # We need to patch the function that was imported into app.py
        with patch('app.generate_product_suggestions') as mock_suggest:
            mock_suggest.return_value = {
                "title": "Delicious Mango",
                "description": "Best mango ever",
                "tags": ["fruit", "sweet"]
            }
            
            headers = self.get_auth_header()
            response = self.app.post('/api/ai/suggest-product', 
                                    data=json.dumps({'input': 'mango'}),
                                    content_type='application/json',
                                    headers=headers)
            
            if response.status_code != 200:
                 print(f"Suggest failed: {response.data}")
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertEqual(data['title'], "Delicious Mango")
            mock_suggest.assert_called_once_with('mango')

if __name__ == '__main__':
    unittest.main()
