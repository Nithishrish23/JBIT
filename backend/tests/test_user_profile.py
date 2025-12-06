import unittest
import os
import sys
import json
from io import BytesIO

# Add the backend directory to the path to import app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app, db, User, File

class UserProfileTest(unittest.TestCase):
    def setUp(self):
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        app.config['TESTING'] = True
        app.config['JWT_SECRET_KEY'] = 'test-secret'
        app.config['UPLOAD_FOLDER'] = os.path.abspath(os.path.join(os.path.dirname(__file__), 'temp_uploads'))
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        self.app = app.test_client()
        
        with app.app_context():
            db.create_all()
            # Create a test user
            user = User(name='Test User', email='test@example.com', role='user')
            user.set_password('password123')
            db.session.add(user)
            db.session.commit()
            self.user_id = user.id

    def tearDown(self):
        with app.app_context():
            db.session.remove()
            db.drop_all()
        if os.path.exists(app.config['UPLOAD_FOLDER']):
            for f in os.listdir(app.config['UPLOAD_FOLDER']):
                os.remove(os.path.join(app.config['UPLOAD_FOLDER'], f))
            os.rmdir(app.config['UPLOAD_FOLDER'])

    def get_auth_header(self):
        # Login to get token
        response = self.app.post('/api/auth/login', json={
            'email': 'test@example.com',
            'password': 'password123'
        })
        token = response.json['access_token']
        return {'Authorization': f'Bearer {token}'}

    def test_update_profile_name_phone(self):
        headers = self.get_auth_header()
        data = {'name': 'Updated Name', 'phone': '1234567890'}
        response = self.app.put('/api/user/profile', json=data, headers=headers)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['user']['name'], 'Updated Name')
        self.assertEqual(response.json['user']['phone'], '1234567890')
        
        # Verify in DB
        with app.app_context():
            user = User.query.get(self.user_id)
            self.assertEqual(user.name, 'Updated Name')
            self.assertEqual(user.phone, '1234567890')

    def test_change_password_success(self):
        headers = self.get_auth_header()
        data = {
            'current_password': 'password123',
            'new_password': 'newpassword456'
        }
        response = self.app.put('/api/user/password', json=data, headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['message'], 'Password updated successfully')

        # Verify login with new password
        login_response = self.app.post('/api/auth/login', json={
            'email': 'test@example.com',
            'password': 'newpassword456'
        })
        self.assertEqual(login_response.status_code, 200)

    def test_change_password_incorrect_current(self):
        headers = self.get_auth_header()
        data = {
            'current_password': 'wrongpassword',
            'new_password': 'newpassword456'
        }
        response = self.app.put('/api/user/password', json=data, headers=headers)
        self.assertEqual(response.status_code, 401)

    def test_change_password_short_new(self):
        headers = self.get_auth_header()
        data = {
            'current_password': 'password123',
            'new_password': 'short'
        }
        response = self.app.put('/api/user/password', json=data, headers=headers)
        self.assertEqual(response.status_code, 400)

    def test_upload_file_generic(self):
        headers = self.get_auth_header()
        data = {
            'file': (BytesIO(b'test image content'), 'test.jpg')
        }
        response = self.app.post('/api/upload', data=data, content_type='multipart/form-data', headers=headers)
        self.assertEqual(response.status_code, 201)
        self.assertIn('url', response.json)
        self.assertIn('id', response.json)

if __name__ == '__main__':
    unittest.main()
