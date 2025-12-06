from flask import Flask, request, jsonify, abort, send_file, send_from_directory
from extensions import db, jwt, socketio
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity, get_jwt, verify_jwt_in_request
)
from flask_cors import CORS
from flask_socketio import emit
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from uuid import uuid4
import requests
import os
from datetime import datetime, timedelta
from logging.handlers import RotatingFileHandler
import logging
from dotenv import load_dotenv

# Load environment variables from .env file in the same directory
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# ---- Payment SDKs ----
import razorpay
import stripe
from ai_service import generate_product_suggestions
from services import send_email, send_push_notification
from ai_routes import ai_bp
from superadmin import super_admin_bp

# -------------------
# App & Config
# -------------------
app = Flask(__name__, instance_relative_config=True)

# Use a deterministic instance path next to this file so the DB is always
# created/used from the same location regardless of working directory.
base_dir = os.path.abspath(os.path.dirname(__file__))
instance_dir = os.path.join(base_dir, 'instance')
os.makedirs(instance_dir, exist_ok=True)
db_path = os.path.join(instance_dir, 'ecommerce.db')
# Use forward slashes for sqlite URI on Windows as well
default_db_uri = f"sqlite:///{db_path.replace('\\', '/') }"

db_url_from_env = os.getenv("DB_URL")
configured_db_uri = default_db_uri

if db_url_from_env:
    if db_url_from_env.startswith('sqlite:///'):
        if db_url_from_env.startswith('sqlite:////'): # Absolute path on some systems
            path_part = db_url_from_env[10:]
        else:
            path_part = db_url_from_env[10:]

        if not os.path.isabs(path_part):
            abs_db_path = os.path.join(base_dir, path_part)
        else:
            abs_db_path = path_part

        db_file_dir = os.path.dirname(abs_db_path);
        os.makedirs(db_file_dir, exist_ok=True);

        configured_db_uri = f"sqlite:///{abs_db_path.replace('\\', '/')}"
    else:
        configured_db_uri = db_url_from_env

app.config['SQLALCHEMY_DATABASE_URI'] = configured_db_uri

# Configure SQLALCHEMY_BINDS for Super Admin DB
super_admin_db_path = os.path.join(instance_dir, 'super_admin.db')
app.config['SQLALCHEMY_BINDS'] = {
    'superadmin': f"sqlite:///{super_admin_db_path.replace('\\', '/')}"
}

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'change-this-secret'  # change for production

# File upload settings (stored under `instance/uploads`)
app.config['UPLOAD_FOLDER'] = os.path.join(instance_dir, 'uploads')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB limit by default

# Payment config (use environment variables in real projects)
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# Initialize extensions
db.init_app(app)
jwt.init_app(app)
socketio.init_app(app)

CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True, allow_headers=["Content-Type","Authorization"], methods=["GET","HEAD","POST","OPTIONS","PUT","PATCH","DELETE"])

# Configure Logging
log_path = os.path.join(instance_dir, 'app.log')
file_handler = RotatingFileHandler(log_path, maxBytes=1024 * 1024, backupCount=10)
file_handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'))
file_handler.setLevel(logging.INFO)
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)
app.logger.info('Ecommerce startup')

def ensure_db_schema():
    try:
        # Create any missing tables
        db.create_all()
        # Create superadmin tables
        db.create_all(bind='superadmin')
        app.logger.info("Database schema ensured (main + superadmin).")
    except Exception as e:
        app.logger.warning(f'ensure_db_schema error: {e}')

# Run schema ensure at startup
with app.app_context():
    ensure_db_schema()

def emit_update(resource, action, data=None, room=None):
    payload = {
        "resource": resource,
        "action": action,
        "data": data,
        "timestamp": datetime.utcnow().isoformat()
    }
    if room:
        socketio.emit('resource_update', payload, to=room)
    else:
        socketio.emit('resource_update', payload)

app.register_blueprint(ai_bp, url_prefix='/api/ai')
app.register_blueprint(super_admin_bp, url_prefix='/api/superadmin')

# ... [Include other existing routes/functions from original app.py if needed, 
# but mostly we just needed the setup part fixed. The models like User/Product are in app.py originally.
# If I overwrite app.py completely, I lose them unless I copy them. 
# I MUST preserve the Models from the original app.py.
# The previous `replace` might have been safer, but since I am rewriting to fix imports, 
# I need to be careful not to lose User/Product models.]

# WAIT! The previous `read_file` of app.py was truncated.
# If I write `app.py` now with just the above, I DELETE all the E-commerce logic.
# This is dangerous.
# I should use `replace` to fix the specific import lines, OR read the FULL file first.
# I'll use `read_file` to get the REST of app.py and then reconstruct it?
# Or better, just use `replace` on the specific top section which I know matches.

# I will NOT write the file yet. I will use `replace` to fix the imports in `app.py` 
# based on what I see in the file content I read earlier.
# The earlier `replace` call might have failed or not been applied?
# No, the previous turn said "Successfully modified". 
# But the user says they still have error.
# Maybe I didn't replace *all* occurrences or the structure was different.

# Let's try to `read_file` app.py again to see its current state.
