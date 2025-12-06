import unittest
import os
import sys
from io import BytesIO
from datetime import datetime
from unittest.mock import patch, MagicMock
from uuid import uuid4 # Import uuid4

# Add the backend directory to the path to import app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app, db, File, download_file
from werkzeug.datastructures import FileStorage

class ImageServingTest(unittest.TestCase):
    def setUp(self):
        # Use an in-memory SQLite database for testing
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        app.config['TESTING'] = True
        app.config['UPLOAD_FOLDER'] = os.path.abspath(os.path.join(os.path.dirname(__file__), 'temp_uploads'))
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        self.app = app.test_client()
        
        with app.app_context():
            db.create_all()

    def tearDown(self):
        with app.app_context():
            db.session.remove()
            db.drop_all()
        
        # Clean up temp upload folder
        if os.path.exists(app.config['UPLOAD_FOLDER']):
            for f in os.listdir(app.config['UPLOAD_FOLDER']):
                os.remove(os.path.join(app.config['UPLOAD_FOLDER'], f))
            os.rmdir(app.config['UPLOAD_FOLDER'])

    def test_download_file_success(self):
        with app.app_context():
            # 1. Create a dummy image file
            dummy_image_content = b"this is a dummy image content"
            dummy_filename = "test_image.png"
            stored_filename = f"{uuid4().hex}_{dummy_filename}"
            test_filepath = os.path.join(app.config['UPLOAD_FOLDER'], stored_filename)
            
            with open(test_filepath, 'wb') as f:
                f.write(dummy_image_content)

            # 2. Create a mock File record in the database
            mock_file = File(
                owner_id=1,  # Assuming a dummy user ID
                filename=dummy_filename,
                stored_filename=stored_filename,
                filepath=test_filepath, # Store the actual path where it's saved
                size=len(dummy_image_content),
                status='active'
            )
            db.session.add(mock_file)
            db.session.commit()
            
            # 3. Request the file via the endpoint
            response = self.app.get(f'/api/files/{mock_file.id}/download')

            # 4. Assertions
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data, dummy_image_content)
            self.assertIn('image/png', response.headers['Content-Type'])
            
    def test_download_file_not_found_db_or_disk(self):
        with app.app_context():
            # Test case: file_id does not exist in DB
            response = self.app.get('/api/files/999/download')
            self.assertEqual(response.status_code, 404)

            # Test case: file exists in DB but not on disk (and fallback fails)
            mock_file = File(
                owner_id=1,
                filename="non_existent.png",
                stored_filename="non_existent_stored.png",
                filepath="/path/to/nowhere/non_existent.png", # Path that doesn't exist
                size=100,
                status='active'
            )
            db.session.add(mock_file)
            db.session.commit()

            response = self.app.get(f'/api/files/{mock_file.id}/download')
            self.assertEqual(response.status_code, 404)
            self.assertIn(b"File not found on server", response.data) # Assert the custom message

    def test_download_file_fallback_success(self):
        with app.app_context():
            # 1. Create a dummy image content
            dummy_image_content = b"this is another dummy image content for fallback"
            dummy_filename = "fallback_image.jpg"
            stored_filename = f"{uuid4().hex}_{dummy_filename}"
            
            # 2. Save file to the actual UPLOAD_FOLDER
            test_filepath_actual = os.path.join(app.config['UPLOAD_FOLDER'], stored_filename)
            with open(test_filepath_actual, 'wb') as f:
                f.write(dummy_image_content)

            # 3. Create a File record with an INCORRECT/OLD filepath
            mock_file = File(
                owner_id=1,
                filename=dummy_filename,
                stored_filename=stored_filename,
                filepath="/old/invalid/path/fallback_image.jpg", # This path is wrong
                size=len(dummy_image_content),
                status='active'
            )
            db.session.add(mock_file)
            db.session.commit()
            
            # 4. Request the file via the endpoint
            response = self.app.get(f'/api/files/{mock_file.id}/download')

            # 5. Assertions - should use the fallback path successfully
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data, dummy_image_content)
            self.assertIn('image/jpeg', response.headers['Content-Type']) # Mimetype from extension

if __name__ == '__main__':
    unittest.main()
