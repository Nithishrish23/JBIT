# Backend Setup Instructions

## 1. Create Virtual Environment
```bash
python -m venv venv
```

## 2. Activate Virtual Environment
- **Windows:**
  ```bash
  .\venv\Scripts\activate
  ```
- **Mac/Linux:**
  ```bash
  source venv/bin/activate
  ```

## 3. Install Dependencies
```bash
pip install -r requirements.txt
```

## 4. Initialize Database
The application is configured to automatically create the database tables when it runs. However, you can also manually initialize it using the provided command:

```bash
# Ensure you are in the backend directory
cd backend

# Run the init-db command (if implemented in app.py) or simply run the app
python app.py
```

Since the `ensure_db_schema()` function runs on app startup, simply running the application will create the `instance/ecommerce.db` file and all tables.

## 5. Run the Application
```bash
python app.py
```
