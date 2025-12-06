import unittest
from unittest.mock import patch, MagicMock
import sys
import os
import json

# Add parent directory to path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, fetch_api_data

class ExternalApiTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    @patch('app.requests.get')
    def test_fetch_api_data_success(self, mock_get):
        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [{"id": 1, "total": 100}]
        mock_get.return_value = mock_response

        data = fetch_api_data("http://test.url")
        self.assertEqual(data, [{"id": 1, "total": 100}])

    @patch('app.requests.get')
    def test_fetch_api_data_failure(self, mock_get):
        # Mock failure
        mock_get.side_effect = Exception("Connection error")
        
        data = fetch_api_data("http://test.url")
        # Should return empty dict on exception as per implementation
        self.assertEqual(data, {})

    @patch('app.fetch_api_data')
    def test_admin_orders_view_route(self, mock_fetch):
        # Mock the data fetching
        mock_fetch.return_value = [{"id": 101, "customer_name": "Test Client", "total": 500, "status": "Paid"}]
        
        res = self.app.get('/admin/orders-external')
        self.assertEqual(res.status_code, 200)
        self.assertIn(b'Test Client', res.data)
        self.assertIn(b'500', res.data)

if __name__ == '__main__':
    unittest.main()
