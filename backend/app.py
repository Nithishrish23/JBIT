from flask import Flask, request, jsonify, abort, send_file, send_from_directory
from functools import wraps
from extensions import db, jwt, socketio, resolve_tenant
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

# Register Tenant Middleware
@app.before_request
def handle_tenant():
    resolve_tenant(app)

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
        # SQLAlchemy expects sqlite:///path/to/file.db, where path can be absolute or relative
        # and for absolute paths, on Windows it's usually sqlite:///C:/path/to/file.db
        
        # Extract the raw path part from the URI
        # Handle cases like 'sqlite:///path' or 'sqlite:////absolute/path'
        # We need to correctly get 'path' or 'absolute/path'
        if db_url_from_env.startswith('sqlite:////'): # Absolute path on some systems
            path_part = db_url_from_env[10:] # Remove 'sqlite:////'
        else: # Relative or absolute with 3 slashes
            path_part = db_url_from_env[10:] # Remove 'sqlite:///'
            
        print(f"DEBUG: SQLite URL path_part extracted: {path_part}")

        # If the path is not absolute (e.g., './instance/ecommerce.db' or 'instance/ecommerce.db')
        if not os.path.isabs(path_part):
            # Resolve relative path against the application's base_dir (which is backend/)
            abs_db_path = os.path.join(base_dir, path_part)
        else:
            # Path is already absolute
            abs_db_path = path_part
        
        print(f"DEBUG: Resolved abs_db_path: {abs_db_path}")

        # Ensure the directory for the DB file exists
        db_file_dir = os.path.dirname(abs_db_path);
        os.makedirs(db_file_dir, exist_ok=True);
        
        # Format as an absolute SQLite URI with forward slashes for SQLAlchemy
        configured_db_uri = f"sqlite:///{abs_db_path.replace('\\', '/')}"
    else:
        # Non-SQLite DB_URL, use as is
        configured_db_uri = db_url_from_env

app.config['SQLALCHEMY_DATABASE_URI'] = configured_db_uri
print(f"DEBUG: Final SQLALCHEMY_DATABASE_URI set: {app.config['SQLALCHEMY_DATABASE_URI']}")

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

from flask_cors import CORS, cross_origin
from sqlalchemy import text

CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True, allow_headers=["Content-Type","Authorization","X-Tenant-Domain"], methods=["GET","HEAD","POST","OPTIONS","PUT","PATCH","DELETE"])

# Configure Logging
if not app.debug:
    pass

log_path = os.path.join(instance_dir, 'app.log')
file_handler = RotatingFileHandler(log_path, maxBytes=1024 * 1024, backupCount=10)
file_handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'))
file_handler.setLevel(logging.INFO)
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)
app.logger.info('Ecommerce startup')


# Ensure DB exists and apply lightweight schema fixes for development
def ensure_db_schema():
    try:
        # Create any missing tables for main DB
        db.create_all()
        
        # Create superadmin tables
        db.create_all(bind_key='superadmin')
        
        # Check for missing columns in 'clients' table (Superadmin DB)
        try:
            with app.app_context(): # Ensure we are in app context for db.engines
                engine = db.engines['superadmin']
                with engine.connect() as conn:
                    # Check columns in 'clients'
                    res = conn.execute(text("PRAGMA table_info('clients')")).fetchall()
                    cols = [r[1] for r in res]
                    
                    # Add missing columns with ALTER TABLE
                    if 'subdomain' not in cols:
                        app.logger.info('Adding missing column clients.subdomain')
                        conn.execute(text('ALTER TABLE clients ADD COLUMN subdomain TEXT'))
                    
                    if 'custom_domain' not in cols:
                        app.logger.info('Adding missing column clients.custom_domain')
                        conn.execute(text('ALTER TABLE clients ADD COLUMN custom_domain TEXT'))
                        
                    if 'theme_config' not in cols:
                        app.logger.info('Adding missing column clients.theme_config')
                        conn.execute(text('ALTER TABLE clients ADD COLUMN theme_config JSON'))
                    conn.commit() # Commit changes to the superadmin DB
        except Exception as e:
             app.logger.warning(f'Could not ensure superadmin schema columns: {e}')

        # Check for missing invoice_html column on Order and add if needed (Main DB)
        try:
            # Ensure Order columns
            res = db.session.execute(text("PRAGMA table_info('order')")).fetchall()
            cols = [r[1] for r in res]
            if 'invoice_html' not in cols:
                app.logger.info('Adding missing column order.invoice_html')
                db.session.execute(text('ALTER TABLE "order" ADD COLUMN invoice_html TEXT'))
                db.session.commit()
            if 'delivery_info' not in cols:
                app.logger.info('Adding missing column order.delivery_info')
                db.session.execute(text('ALTER TABLE "order" ADD COLUMN delivery_info TEXT'))
                db.session.commit()
            
            # Ensure User columns (phone, profile_photo_id, client_id, is_first_login, shop_details)
            res_user = db.session.execute(text("PRAGMA table_info('user')")).fetchall()
            cols_user = [r[1] for r in res_user]
            if 'phone' not in cols_user:
                app.logger.info('Adding missing column user.phone')
                db.session.execute(text('ALTER TABLE "user" ADD COLUMN phone TEXT'))
                db.session.commit()
            if 'profile_photo_id' not in cols_user:
                app.logger.info('Adding missing column user.profile_photo_id')
                db.session.execute(text('ALTER TABLE "user" ADD COLUMN profile_photo_id INTEGER REFERENCES file(id)'))
                db.session.commit()
            if 'gst_number' not in cols_user:
                app.logger.info('Adding missing column user.gst_number')
                db.session.execute(text('ALTER TABLE "user" ADD COLUMN gst_number TEXT'))
                db.session.commit()
            if 'client_id' not in cols_user:
                app.logger.info('Adding missing column user.client_id')
                db.session.execute(text('ALTER TABLE "user" ADD COLUMN client_id TEXT'))
                db.session.commit()
            if 'is_first_login' not in cols_user:
                app.logger.info('Adding missing column user.is_first_login')
                db.session.execute(text('ALTER TABLE "user" ADD COLUMN is_first_login BOOLEAN DEFAULT 0'))
                db.session.commit()
            if 'shop_details' not in cols_user:
                app.logger.info('Adding missing column user.shop_details')
                db.session.execute(text('ALTER TABLE "user" ADD COLUMN shop_details JSON'))
                db.session.commit()
            
            # Ensure Product columns (average_rating, review_count)
            res_prod = db.session.execute(text("PRAGMA table_info('product')")).fetchall()
            cols_prod = [r[1] for r in res_prod]
            if 'average_rating' not in cols_prod:
                app.logger.info('Adding missing column product.average_rating')
                db.session.execute(text('ALTER TABLE "product" ADD COLUMN average_rating FLOAT DEFAULT 0.0'))
                db.session.commit()
            if 'review_count' not in cols_prod:
                app.logger.info('Adding missing column product.review_count')
                db.session.execute(text('ALTER TABLE "product" ADD COLUMN review_count INTEGER DEFAULT 0'))
                db.session.commit()
            if 'brand' not in cols_prod:
                app.logger.info('Adding missing column product.brand')
                db.session.execute(text('ALTER TABLE "product" ADD COLUMN brand TEXT'))
                db.session.commit()
            if 'specifications' not in cols_prod:
                app.logger.info('Adding missing column product.specifications')
                db.session.execute(text('ALTER TABLE "product" ADD COLUMN specifications JSON'))
                db.session.commit()

            # Ensure Address columns (is_default)
            res_addr = db.session.execute(text("PRAGMA table_info('address')")).fetchall()
            cols_addr = [r[1] for r in res_addr]
            if 'is_default' not in cols_addr:
                app.logger.info('Adding missing column address.is_default')
                db.session.execute(text('ALTER TABLE "address" ADD COLUMN is_default BOOLEAN DEFAULT 0'))
                db.session.commit()

        except Exception as e:
            app.logger.warning(f'Could not ensure schema columns: {e}')
    except Exception as e:
        app.logger.warning(f'ensure_db_schema error: {e}')

# Run schema ensure at startup moved after models definition



# Ensure OPTIONS preflight requests are handled before decorators like jwt_required run
@app.before_request
def handle_options():
    if request.method == 'OPTIONS':
        # Flask-CORS will add appropriate headers; return empty 200 so preflight succeeds
        return ('', 200)

# Init payment clients (use env values as fallback; settings DB may override at runtime)
try:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
except Exception:
    razorpay_client = None

try:
    stripe.api_key = STRIPE_SECRET_KEY
except Exception:
    pass

# Provide friendly JSON responses for common JWT errors to avoid 422 HTML responses
@jwt.unauthorized_loader
def my_unauthorized_callback(err_str):
    return jsonify({"msg": "Missing Authorization Header or token" , "error": err_str}), 401

@jwt.invalid_token_loader
def my_invalid_token_callback(err_str):
    return jsonify({"msg": "Invalid token", "error": err_str}), 401

@jwt.expired_token_loader
def my_expired_token_callback(jwt_header, jwt_payload):
    return jsonify({"msg": "Token has expired"}), 401

def emit_update(resource, action, data=None, room=None):
    """
    Helper to emit updates to connected clients.
    :param resource: Resource name (e.g., 'product', 'order')
    :param action: Action type (e.g., 'created', 'updated', 'deleted')
    :param data: Payload data
    :param room: Optional room to target specific users
    """
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

# -------------------
# Models
# -------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='user')  # admin, seller, user, delivery
    is_active = db.Column(db.Boolean, default=True)
    is_approved = db.Column(db.Boolean, default=False) # Added for seller approval
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    phone = db.Column(db.String(20))
    profile_photo_id = db.Column(db.Integer, db.ForeignKey('file.id'))

    profile_photo = db.relationship('File', foreign_keys=[profile_photo_id])

    # Bank Details for Sellers
    bank_account_number = db.Column(db.String(50))
    bank_ifsc = db.Column(db.String(20))
    bank_beneficiary_name = db.Column(db.String(100))
    upi_id = db.Column(db.String(50))
    preferred_payout_method = db.Column(db.String(20), default='bank') # 'bank' or 'upi'
    razorpay_fund_account_id = db.Column(db.String(100))
    razorpay_contact_id = db.Column(db.String(100))
    gst_number = db.Column(db.String(20)) # Added GST Number
    
    # Multi-tenancy & Onboarding
    client_id = db.Column(db.String(36)) # Link to SuperAdmin Client ID
    is_first_login = db.Column(db.Boolean, default=False) # If true, force onboarding
    shop_details = db.Column(db.JSON, default={}) # Store shop name, address extra info

    def set_password(self, pwd):
        self.password_hash = generate_password_hash(pwd)

    def check_password(self, pwd):
        return check_password_hash(self.password_hash, pwd)

    def to_dict(self):
        # Fetch address if available (default one preferably)
        address = None
        if self.addresses:
            default_addr = next((a for a in self.addresses if a.is_default), None)
            if default_addr:
                address = default_addr.to_dict()
            elif len(self.addresses) > 0:
                address = self.addresses[0].to_dict()

        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "is_approved": self.is_approved,
            "phone": self.phone,
            "gst_number": self.gst_number,
            "client_id": self.client_id,
            "is_first_login": self.is_first_login,
            "shop_details": self.shop_details,
            "address": address, # Full address object
            "profile_photo": f"/api/files/{self.profile_photo_id}/download" if self.profile_photo_id else None
        }


class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True) # Enforce unique name
    slug = db.Column(db.String(120), unique=True, nullable=False)
    description = db.Column(db.Text, default="")
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True) # Nullable for admin/global categories
    is_approved = db.Column(db.Boolean, default=False) # For seller defined categories

    seller = db.relationship('User', foreign_keys=[seller_id])

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "seller_id": self.seller_id,
            "is_approved": self.is_approved,
            "seller_name": self.seller.name if self.seller else "System"
        }

class CategoryPermission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    permission_level = db.Column(db.String(20), default='read') # read, write, admin

    category = db.relationship('Category')
    user = db.relationship('User')


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default="")
    price = db.Column(db.Float, nullable=False)
    mrp = db.Column(db.Float, default=0.0) # Maximum Retail Price
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    sku = db.Column(db.String(50)) # Added SKU
    average_rating = db.Column(db.Float, default=0.0)
    review_count = db.Column(db.Integer, default=0)
    brand = db.Column(db.String(100))
    specifications = db.Column(db.JSON) # Use JSON type (Text in SQLite, JSON in PG)

    seller = db.relationship('User', backref='products')
    category = db.relationship('Category', backref='products')
    inventory = db.relationship('Inventory', backref='product', uselist=False)

    def to_dict(self):
        return {
            "id": self.id,
            "seller_id": self.seller_id,
            "category_id": self.category_id,
            "name": self.name,
            "description": self.description,
            "is_approved": self.status == 'approved', # Match frontend boolean
            "price": self.price,
            "mrp": self.mrp,
            "discount_percent": int(((self.mrp - self.price) / self.mrp * 100)) if self.mrp > self.price else 0,
            "status": self.status,
            "stock_qty": self.inventory.stock_qty if self.inventory else 0,
            "images": self._image_list(),
            "sku": self.sku,
            "average_rating": self.average_rating,
            "review_count": self.review_count,
            "brand": self.brand,
            "specifications": self.specifications,
            "seller": {
                "name": self.seller.name if self.seller else "Unknown",
                "email": self.seller.email if self.seller else ""
            }
        }

    def _image_list(self):
        try:
            imgs = []
            # product_images relationship may not be present until migrations create the table
            for pi in sorted(getattr(self, 'product_images', []) or [], key=lambda x: (x.position or 0)):
                if pi.file:
                    imgs.append({
                        "id": pi.file.id,
                        "filename": pi.file.filename,
                        "download_url": f"{request.url_root.rstrip('/')}/api/files/{pi.file.id}/download"
                    })
            return imgs
        except Exception:
            return []


class Coupon(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    type = db.Column(db.String(20), default='admin') # admin, seller
    discount_percent = db.Column(db.Float, nullable=False)
    max_discount_amount = db.Column(db.Float)
    min_order_value = db.Column(db.Float, default=0)
    expiry_date = db.Column(db.DateTime)
    usage_limit = db.Column(db.Integer, default=0) # 0 = unlimited
    used_count = db.Column(db.Integer, default=0)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True) # If type=seller
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    seller = db.relationship('User')

class Inventory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), unique=True)
    stock_qty = db.Column(db.Integer, default=0)
    low_stock_threshold = db.Column(db.Integer, default=5)


class ProductImage(db.Model):
    """Associates uploaded File records with a Product and an ordering position."""
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    file_id = db.Column(db.Integer, db.ForeignKey('file.id'), nullable=False)
    position = db.Column(db.Integer, default=0)

    product = db.relationship('Product', backref='product_images')
    file = db.relationship('File')


class Cart(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True)
    coupon_code = db.Column(db.String(50))
    user = db.relationship('User', backref='cart')


class CartItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cart_id = db.Column(db.Integer, db.ForeignKey('cart.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, default=1)

    cart = db.relationship('Cart', backref='items')
    product = db.relationship('Product')


class Wishlist(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True)
    user = db.relationship('User', backref='wishlist')


class WishlistItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    wishlist_id = db.Column(db.Integer, db.ForeignKey('wishlist.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)

    wishlist = db.relationship('Wishlist', backref='items')
    product = db.relationship('Product')


class Address(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    address_line_1 = db.Column(db.String(255), nullable=False)
    city = db.Column(db.String(100), nullable=False)
    state = db.Column(db.String(100), nullable=False)
    postal_code = db.Column(db.String(20), nullable=False)
    country = db.Column(db.String(100), default="India")
    is_default = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='addresses')

    def to_dict(self):
        return {
            "id": self.id,
            "address_line_1": self.address_line_1,
            "city": self.city,
            "state": self.state,
            "postal_code": self.postal_code,
            "country": self.country,
            "is_default": self.is_default
        }


class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    total_amount = db.Column(db.Float, default=0)
    status = db.Column(db.String(20), default='pending')  # pending, paid, shipped, delivered, cancelled
    payment_status = db.Column(db.String(20), default='unpaid')
    payment_gateway = db.Column(db.String(20))  # razorpay, stripe, paytm, phonepe
    payment_reference = db.Column(db.String(120))
    invoice_html = db.Column(db.Text)
    delivery_info = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='orders')


class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)
    subtotal = db.Column(db.Float, nullable=False)

    order = db.relationship('Order', backref='items')
    product = db.relationship('Product')
    seller = db.relationship('User')


class Review(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='reviews')
    product = db.relationship('Product', backref='reviews')

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "user_id": self.user_id,
            "user_name": self.user.name,
            "rating": self.rating,
            "comment": self.comment,
            "created_at": self.created_at.isoformat()
        }


class WithdrawalRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='requested')  # requested, approved, paid, rejected
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.DateTime)
    payout_id = db.Column(db.String(100)) # Razorpay Payout ID
    rejection_reason = db.Column(db.Text)

    seller = db.relationship('User')


class PaymentRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    withdrawal_id = db.Column(db.Integer, db.ForeignKey('withdrawal_request.id'), nullable=True)
    amount = db.Column(db.Float)
    method = db.Column(db.String(64))
    details = db.Column(db.Text)
    paid_at = db.Column(db.DateTime, default=datetime.utcnow)
    admin_id = db.Column(db.Integer, db.ForeignKey('user.id'))

    withdrawal = db.relationship('WithdrawalRequest', backref='payments')
    admin = db.relationship('User')


class PaymentTransaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(10), default='INR')
    payment_status = db.Column(db.String(20), nullable=False)  # success, failure, pending
    payment_gateway = db.Column(db.String(20))
    transaction_id = db.Column(db.String(120)) # Gateway's transaction ID
    failure_reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    order = db.relationship('Order', backref='transactions')


class SellerPurchaseBill(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    supplier_name = db.Column(db.String(200))
    bill_number = db.Column(db.String(100))
    total_amount = db.Column(db.Float)
    bill_date = db.Column(db.DateTime, default=datetime.utcnow)


class SellerSalesBill(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=True)
    bill_number = db.Column(db.String(100))
    total_amount = db.Column(db.Float)
    bill_date = db.Column(db.DateTime, default=datetime.utcnow)


class SellerRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), default='requested')  # requested, approved, rejected
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
    note = db.Column(db.Text)

    user = db.relationship('User')


class Advertisement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    text = db.Column(db.String(500))
    image_url = db.Column(db.String(255))
    footer_logo_url = db.Column(db.String(255)) 
    target_url = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)
    position = db.Column(db.String(50), default="home_banner")
    priority = db.Column(db.Integer, default=0)
    start_date = db.Column(db.DateTime, nullable=True)
    end_date = db.Column(db.DateTime, nullable=True)
    target_roles = db.Column(db.String(200), nullable=True)
    views = db.Column(db.Integer, default=0)
    clicks = db.Column(db.Integer, default=0)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=True) # New field
    product = db.relationship('Product') # New relationship

    def to_dict(self):
        data = {
            "id": self.id,
            "title": self.title,
            "text": self.text,
            "image_url": self.image_url,
            "footer_logo_url": self.footer_logo_url,
            "target_url": self.target_url,
            "is_active": self.is_active,
            "position": self.position,
            "priority": self.priority,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "target_roles": self.target_roles,
            "views": self.views,
            "clicks": self.clicks,
            "product_id": self.product_id # New field in to_dict
        }
        if self.product: # Include product details if linked
            data['product_name'] = self.product.name
            data['product_price'] = self.product.price
        return data

class NewsletterSubscriber(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    is_confirmed = db.Column(db.Boolean, default=False)
    confirmation_token = db.Column(db.String(100), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    gdpr_consent = db.Column(db.Boolean, default=False)

class SupportTicket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    email = db.Column(db.String(120))
    subject = db.Column(db.String(200))
    message = db.Column(db.Text)
    status = db.Column(db.String(20), default='open')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User')

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else "Guest",
            "email": self.email or (self.user.email if self.user else "Unknown"),
            "subject": self.subject,
            "message": self.message,
            "status": self.status,
            "created_at": self.created_at.isoformat()
        }

class Setting(db.Model):
    """Simple key/value store for admin-configurable settings."""
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(200), unique=True, nullable=False)
    value = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class File(db.Model):
    """Represents an uploaded file stored on disk with associated metadata."""
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    stored_filename = db.Column(db.String(255), nullable=False, unique=True)
    filepath = db.Column(db.String(1024), nullable=False)
    status = db.Column(db.String(32), default='pending')
    size = db.Column(db.Integer, default=0)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, include_owner=False):
        data = {
            'id': self.id,
            'owner_id': self.owner_id,
            'filename': self.filename,
            'stored_filename': self.stored_filename,
            'status': self.status,
            'size': self.size,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_owner:
            owner = User.query.get(self.owner_id)
            if owner:
                data['owner'] = {'id': owner.id, 'email': owner.email}
        return data

# Run schema ensure at startup (after models are defined)
with app.app_context():
    ensure_db_schema()
    # Migration: Add new Advertisement columns if missing
    try:
        res_ads = db.session.execute(text("PRAGMA table_info('advertisement')")).fetchall()
        cols_ads = [r[1] for r in res_ads]
        
        if 'footer_logo_url' not in cols_ads:
            app.logger.info('Adding missing column advertisement.footer_logo_url')
            db.session.execute(text('ALTER TABLE "advertisement" ADD COLUMN footer_logo_url TEXT'))
        
        if 'text' not in cols_ads:
            app.logger.info('Adding missing column advertisement.text')
            db.session.execute(text('ALTER TABLE "advertisement" ADD COLUMN text TEXT'))
            
        if 'start_date' not in cols_ads:
            app.logger.info('Adding missing column advertisement.start_date')
            db.session.execute(text('ALTER TABLE "advertisement" ADD COLUMN start_date DATETIME'))
            
        if 'end_date' not in cols_ads:
            app.logger.info('Adding missing column advertisement.end_date')
            db.session.execute(text('ALTER TABLE "advertisement" ADD COLUMN end_date DATETIME'))
            
        if 'target_roles' not in cols_ads:
            app.logger.info('Adding missing column advertisement.target_roles')
            db.session.execute(text('ALTER TABLE "advertisement" ADD COLUMN target_roles TEXT'))
            
        if 'views' not in cols_ads:
            app.logger.info('Adding missing column advertisement.views')
            db.session.execute(text('ALTER TABLE "advertisement" ADD COLUMN views INTEGER DEFAULT 0'))
            
        if 'clicks' not in cols_ads:
            app.logger.info('Adding missing column advertisement.clicks')
            db.session.execute(text('ALTER TABLE "advertisement" ADD COLUMN clicks INTEGER DEFAULT 0'))
            
        db.session.commit()
    except Exception as e:
        app.logger.warning(f'Migration error: {e}')

# -------------------
# Helpers
# -------------------
def send_notification(user_email, subject, message, sms_to=None, user_id=None):
    """
    Sends email and push notifications using configured services.
    """
    try:
        # Log the notification
        app.logger.info(f"NOTIFICATION: To={user_email}, Subject={subject}, Msg={message}")
        
        # Send Email
        send_email(user_email, subject, f"<p>{message}</p>")

        # Send Push Notification (if user_id provided)
        if user_id:
            send_push_notification(user_id, subject, message)
            
    except Exception as e:
        app.logger.error(f"Failed to send notification: {e}")

def role_required(*roles):
    """Decorator to check for user roles. Skips JWT check for OPTIONS preflight so CORS works."""
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            # Allow CORS preflight requests through
            if request.method == 'OPTIONS':
                return jsonify({}), 200
            # Verify JWT present for actual requests
            try:
                verify_jwt_in_request()
            except Exception as e:
                # Log helpful debug info for local troubleshooting
                auth_hdr = request.headers.get('Authorization')
                app.logger.warning(f"role_required: verify_jwt_in_request failed: {e}; Authorization={auth_hdr}")
                # Return a JSON 401 explaining the issue
                return jsonify({"msg": "Missing or invalid token", "detail": str(e)}), 401

            claims = get_jwt()
            user_role = claims.get('role')
            if user_role not in roles:
                app.logger.warning(f"role_required: insufficient role - have={user_role} need={roles}")
                abort(403, description="Forbidden: Insufficient role")
            return fn(*args, **kwargs)
        return decorator
    return wrapper

def auth_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if request.method == 'OPTIONS':
            return jsonify({}), 200
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            abort(403, description="Forbidden: user not found")
        return fn(*args, **kwargs)
    return wrapper
    

def decrease_stock(product_id, qty):
    inv = Inventory.query.filter_by(product_id=product_id).with_for_update().first()
    if not inv or inv.stock_qty < qty:
        raise ValueError("Insufficient stock")
    inv.stock_qty -= qty


def increase_stock(product_id, qty):
    inv = Inventory.query.filter_by(product_id=product_id).with_for_update().first()
    if not inv:
        inv = Inventory(product_id=product_id, stock_qty=0)
        db.session.add(inv)
    inv.stock_qty += qty


def get_or_create_cart(user_id):
    cart = Cart.query.filter_by(user_id=user_id).first()
    if not cart:
        cart = Cart(user_id=user_id)
        db.session.add(cart)
        db.session.commit()
    return cart


def get_or_create_wishlist(user_id):
    wl = Wishlist.query.filter_by(user_id=user_id).first()
    if not wl:
        wl = Wishlist(user_id=user_id)
        db.session.add(wl)
        db.session.commit()
    return wl


def get_setting(key, default=None):
    try:
        s = Setting.query.filter_by(key=key).first()
        if s:
            return s.value
    except Exception:
        # If DB isn't available yet or table missing, fall back silently
        pass
    return default


def set_setting(key, value):
    s = Setting.query.filter_by(key=key).first()
    if s:
        s.value = value
    else:
        s = Setting(key=key, value=value)
        db.session.add(s)
    db.session.commit()
    return s


def load_payment_clients_from_settings():
    """Reinitialize payment clients using persisted settings (if present).

    This function is safe to call at runtime (after DB is available).
    """
    global razorpay_client, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, STRIPE_SECRET_KEY
    try:
        rp_id = get_setting('razorpay_key_id', RAZORPAY_KEY_ID)
        rp_secret = get_setting('razorpay_key_secret', RAZORPAY_KEY_SECRET)
        stripe_key = get_setting('stripe_secret_key', STRIPE_SECRET_KEY)

        # Update globals used elsewhere in the module
        RAZORPAY_KEY_ID = rp_id or RAZORPAY_KEY_ID
        RAZORPAY_KEY_SECRET = rp_secret or RAZORPAY_KEY_SECRET
        STRIPE_SECRET_KEY = stripe_key or STRIPE_SECRET_KEY

        try:
            razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        except Exception:
            razorpay_client = None

        try:
            stripe.api_key = STRIPE_SECRET_KEY
        except Exception:
            pass
    except Exception:
        # On any failure, keep existing clients/env values
        pass


@app.route('/api/support/contact', methods=['POST'])
def submit_support_ticket():
    data = request.json or {}
    # If logged in, get user_id
    user_id = None
    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
    except:
        pass

    ticket = SupportTicket(
        user_id=user_id,
        email=data.get('email'), # Optional if guest, or override
        subject=data.get('subject'),
        message=data.get('message')
    )
    
    if not ticket.subject or not ticket.message:
        return jsonify({"error": "Subject and message required"}), 400

    db.session.add(ticket)
    db.session.commit()
    
    # Notify Admin (Log for now)
    app.logger.info(f"New Support Ticket #{ticket.id}: {ticket.subject}")
    
    return jsonify({"message": "Ticket submitted successfully"})

@app.route('/api/admin/support', methods=['GET'])
@role_required('admin')
def admin_get_support_tickets():
    tickets = SupportTicket.query.order_by(SupportTicket.created_at.desc()).all()
    return jsonify([t.to_dict() for t in tickets])

@app.route('/api/admin/support/<int:id>/status', methods=['PUT'])
@role_required('admin')
def admin_update_ticket_status(id):
    ticket = SupportTicket.query.get_or_404(id)
    data = request.json or {}
    if 'status' in data:
        ticket.status = data['status']
        db.session.commit()
    return jsonify(ticket.to_dict())

# -------------------
# Auth Routes
# -------------------
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    phone = data.get('phone') # New field
    role = data.get('role', 'user')  # 'user' or 'seller' (if allowed publicly)

    if not all([name, email, password]):
        return jsonify({"msg": "Missing required fields"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "User already exists"}), 400

    user = User(name=name, email=email, role=role, phone=phone)
    user.set_password(password)
    
    # If role is seller, they might need approval. Default is_approved=False for sellers.
    if role == 'seller':
        user.is_approved = False
    
    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity=user.id, additional_claims={"role": user.role})
    return jsonify(access_token=access_token, user=user.to_dict()), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email', '').strip()
    password = data.get('password')
    
    # Debug log
    app.logger.info(f"Login attempt for: '{email}'")
    
    user = User.query.filter_by(email=email).first()
    
    if not user:
        app.logger.warning(f"Login failed: User not found for '{email}'")
        abort(401, description="Invalid credentials")
        
    if not user.check_password(password):
        app.logger.warning(f"Login failed: Password mismatch for '{email}'")
        abort(401, description="Invalid credentials")
    
    # Check for first login / forced reset
    if user.is_first_login:
        # Return a temporary token that only allows access to onboarding
        temp_token = create_access_token(identity=str(user.id), additional_claims={"role": "onboarding", "temp": True}, expires_delta=timedelta(minutes=15))
        return jsonify({
            "msg": "Password reset required",
            "require_onboarding": True,
            "temp_token": temp_token,
            "user": user.to_dict()
        })

    # Ensure identity is a string so JWT 'sub' (subject) claim is serialized as a string
    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role, "client_id": user.client_id})
    # Return snake_case key `access_token` to match frontend expectations
    return jsonify(access_token=token, user=user.to_dict())

@app.route('/api/auth/complete-onboarding', methods=['POST'])
@jwt_required()
def complete_onboarding():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    data = request.json or {}
    
    new_password = data.get('new_password')
    name = data.get('name')
    phone = data.get('phone')
    address = data.get('address')
    shop_name = data.get('shop_name')
    
    if not new_password:
        return jsonify({"error": "New password is required"}), 400

    user.set_password(new_password)
    user.is_first_login = False
    
    if name: user.name = name
    if phone: user.phone = phone
    
    # Update shop details
    current_details = user.shop_details or {}
    if shop_name: current_details['shop_name'] = shop_name
    user.shop_details = current_details
    
    # Save address if provided
    if address:
        # Check if address exists
        addr = Address.query.filter_by(user_id=user.id).first()
        if not addr:
            addr = Address(user_id=user.id, address_line_1=address, city="Unknown", state="Unknown", postal_code="000000", is_default=True)
            db.session.add(addr)
        else:
            addr.address_line_1 = address
            
    db.session.commit()
    
    # Issue real token
    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role, "client_id": user.client_id})
    return jsonify(access_token=token, user=user.to_dict())


@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def me():
    user = User.query.get_or_404(get_jwt_identity())
    return jsonify(user.to_dict())



# -------------------
# Static Image Serving
# -------------------
@app.route('/api/static/images/<path:filename>')
def serve_static_image(filename):
    return send_from_directory(os.path.join(base_dir, 'images'), filename)

# -------------------
# File Upload Route
# -------------------


# -------------------
# File Upload Route
# -------------------
@app.route('/api/upload', methods=['POST'])
@jwt_required()
def upload_file():
    user_id = get_jwt_identity()
    if 'file' not in request.files:
        abort(400, description="No file part")
    file = request.files['file']
    if file.filename == '':
        abort(400, description="No selected file")
    
    if file:
        filename = secure_filename(file.filename)
        unique_name = f"{uuid4().hex}_{filename}"
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
        file.save(save_path)
        size = os.path.getsize(save_path)
        
        file_record = File(
            owner_id=user_id,
            filename=filename,
            stored_filename=unique_name,
            filepath=save_path,
            size=size,
            status='active'
        )
        db.session.add(file_record)
        db.session.commit()
        
        return jsonify({
            "message": "File uploaded successfully",
            "id": file_record.id,
            "url": f"/api/files/{file_record.id}/download"
        }), 201

@app.route('/api/categories', methods=['GET'])
def list_categories():
    cats = Category.query.all()
    return jsonify([c.to_dict() for c in cats])

# New route to match frontend call
@app.route('/api/categories/slug/<slug>', methods=['GET'])
def get_category_by_slug(slug):
    category = Category.query.filter_by(slug=slug).first_or_404()
    return jsonify(category.to_dict())


@app.route('/api/products', methods=['GET'])
def list_products():
    # Corrected to filter by category slug from frontend
    category_slug = request.args.get('category')
    brand = request.args.get('brand')
    min_price = request.args.get('min_price')
    max_price = request.args.get('max_price')
    in_stock = request.args.get('in_stock')
    sort_by = request.args.get('sort_by', 'relevance')
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 10, type=int)

    # Only show products that are approved AND whose seller is approved and active
    query = Product.query.join(User, Product.seller_id == User.id).filter(
        Product.status == 'approved',
        User.is_approved == True,
        User.is_active == True
    )
    if category_slug:
        query = query.join(Category).filter(Category.slug == category_slug)
    
    if brand:
        query = query.filter(Product.brand == brand)
    
    if min_price:
        try:
            query = query.filter(Product.price >= float(min_price))
        except: pass
        
    if max_price:
        try:
            query = query.filter(Product.price <= float(max_price))
        except: pass

    if in_stock == 'true':
        query = query.join(Inventory).filter(Inventory.stock_qty > 0)
    
    # Sorting
    if sort_by == 'price_low_high':
        query = query.order_by(Product.price.asc())
    elif sort_by == 'price_high_low':
        query = query.order_by(Product.price.desc())
    elif sort_by == 'popularity':
        query = query.order_by(Product.review_count.desc(), Product.average_rating.desc())
    elif sort_by == 'newest':
        query = query.order_by(Product.created_at.desc())
    else: # relevance / default
        query = query.order_by(Product.created_at.desc())

    pagination = query.paginate(page=page, per_page=limit, error_out=False)

    return jsonify({
        "items": [p.to_dict() for p in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": pagination.page,
        "per_page": pagination.per_page
    })

@app.route('/api/products/filters', methods=['GET'])
def get_product_filters():
    category_slug = request.args.get('category')
    
    query = Product.query.join(User).filter(
        Product.status == 'approved', 
        User.is_approved == True, 
        User.is_active == True
    )
    
    if category_slug:
        query = query.join(Category).filter(Category.slug == category_slug)

    # Distinct Brands
    brands = [r[0] for r in query.with_entities(Product.brand).distinct().all() if r[0]]
    
    # Price Range
    price_stats = query.with_entities(db.func.min(Product.price), db.func.max(Product.price)).first()
    
    return jsonify({
        "brands": brands,
        "min_price": price_stats[0] or 0,
        "max_price": price_stats[1] or 0
    })

# New route for featured products
@app.route('/api/products/featured', methods=['GET'])
def get_featured_products():
    # Also filter featured products by seller status
    products = Product.query.join(User, Product.seller_id == User.id).filter(
        Product.status == 'approved',
        User.is_approved == True,
        User.is_active == True
    ).limit(16).all()
    return jsonify([p.to_dict() for p in products])


@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    product = Product.query.get_or_404(product_id)
    if product.status != 'approved':
        abort(403, description="Product not approved")
    # Ensure seller is approved/active
    if not product.seller.is_approved or not product.seller.is_active:
        abort(403, description="Seller is inactive")
    return jsonify(product.to_dict())


@app.route('/api/products/<int:product_id>/reviews', methods=['GET'])
def get_product_reviews(product_id):
    Product.query.get_or_404(product_id)
    reviews = Review.query.filter_by(product_id=product_id).order_by(Review.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reviews])


@app.route('/api/products/<int:product_id>/reviews', methods=['POST'])
@jwt_required()
def add_product_review(product_id):
    user_id = int(get_jwt_identity())
    product = Product.query.get_or_404(product_id)
    
    data = request.json or {}
    rating = data.get('rating')
    comment = data.get('comment')
    
    if not rating:
        abort(400, description="Rating is required")
    try:
        rating = int(rating)
        if not (1 <= rating <= 5):
            raise ValueError
    except:
        abort(400, description="Rating must be an integer between 1 and 5")
        
    # Check if user already reviewed
    existing = Review.query.filter_by(product_id=product_id, user_id=user_id).first()
    if existing:
        abort(400, description="You have already reviewed this product")
        
    review = Review(
        product_id=product_id,
        user_id=user_id,
        rating=rating,
        comment=comment
    )
    db.session.add(review)
    
    # Update product stats
    # We do this efficiently: current total score = avg * count
    # new total score = (avg * count) + new_rating
    # new count = count + 1
    # new avg = new total score / new count
    
    current_total_score = (product.average_rating or 0) * (product.review_count or 0)
    new_count = (product.review_count or 0) + 1
    new_avg = (current_total_score + rating) / new_count
    
    product.average_rating = new_avg
    product.review_count = new_count
    
    db.session.commit()
    return jsonify(review.to_dict()), 201


# New route for product search
@app.route('/api/products/search', methods=['GET'])
def search_products():
    search_query = request.args.get('q', '')
    if not search_query:
        return jsonify([])
    products = Product.query.filter(Product.name.ilike(f"%{search_query}%"), Product.status == 'approved').all()
    return jsonify([p.to_dict() for p in products])

# -------------------
# AI Endpoints
# -------------------
@app.route('/api/ai/suggest-product', methods=['POST'])
@jwt_required()
def ai_suggest_product():
    """
    Endpoint for sellers to get AI-generated product titles, descriptions, and tags.
    """
    data = request.get_json()
    if not data or 'input' not in data:
        return jsonify({"error": "Missing 'input' field"}), 400
        
    result = generate_product_suggestions(data['input'])
    if "error" in result:
         return jsonify(result), 500
    return jsonify(result), 200


@app.route('/api/ads', methods=['GET'])
def get_ads():
    position = request.args.get('position', 'home_banner')
    now = datetime.utcnow()
    
    # Base query: Active, correct position
    query = Advertisement.query.filter_by(is_active=True, position=position)
    
    # Filter by date range if set
    query = query.filter(
        db.or_(Advertisement.start_date.is_(None), Advertisement.start_date <= now),
        db.or_(Advertisement.end_date.is_(None), Advertisement.end_date >= now)
    )
    
    # Sort by priority descending
    ads = query.order_by(Advertisement.priority.desc()).all()
    
    # Increment views for fetched ads (simple implementation)
    # In high traffic, this should be batched or async
    for ad in ads:
        ad.views = (ad.views or 0) + 1
    if ads:
        db.session.commit()
        
    return jsonify([a.to_dict() for a in ads])

@app.route('/api/ads/<int:ad_id>/click', methods=['POST'])
def click_ad(ad_id):
    ad = Advertisement.query.get_or_404(ad_id)
    ad.clicks = (ad.clicks or 0) + 1
    db.session.commit()
    return jsonify(message="Click recorded", clicks=ad.clicks)

@app.route('/api/newsletter/subscribe', methods=['POST'])
def newsletter_subscribe():
    data = request.json or {}
    email = data.get('email')
    gdpr_consent = data.get('gdpr_consent')

    if not email or '@' not in email:
        abort(400, description="Invalid email address")
    
    if not gdpr_consent:
        abort(400, description="GDPR consent required")

    existing = NewsletterSubscriber.query.filter_by(email=email).first()
    if existing:
        return jsonify(message="Already subscribed"), 200

    # Generate token
    token = uuid4().hex
    subscriber = NewsletterSubscriber(
        email=email,
        confirmation_token=token,
        gdpr_consent=True
    )
    db.session.add(subscriber)
    db.session.commit()

    # In a real app, send email here with link: /api/newsletter/confirm/<token>
    app.logger.info(f"Newsletter confirmation token for {email}: {token}")

    return jsonify(message="Subscription successful. Please check your email to confirm."), 201

@app.route('/api/newsletter/confirm/<token>', methods=['GET'])
def newsletter_confirm(token):
    subscriber = NewsletterSubscriber.query.filter_by(confirmation_token=token).first_or_404()
    subscriber.is_confirmed = True
    subscriber.confirmation_token = None # Invalidate token
    db.session.commit()
    return jsonify(message="Email confirmed successfully!")

@app.route('/api/newsletter/unsubscribe/<token>', methods=['GET', 'POST'])
def newsletter_unsubscribe(token):
    # In a real scenario, the unsubscribe link might contain a signed token or look up by email+token
    # For this implementation, we'll assume the token passed is the original confirmation token 
    # OR we generate a specific unsubscribe token.
    # Simplified: Look up by email if passed, or if token matches (though token is cleared on confirm).
    # Let's assume we use the email to find the user and a new token isn't needed for this MVP,
    # OR we rely on the user providing their email to unsubscribe.
    
    # Better approach for MVP:
    # Route: /api/newsletter/unsubscribe (POST) body: { email }
    
    # If using GET link:
    # We'd need a persistent token. Let's stick to POST for safety or modify model.
    pass

@app.route('/api/newsletter/unsubscribe', methods=['POST'])
def newsletter_unsubscribe_action():
    data = request.json or {}
    email = data.get('email')
    if not email:
        abort(400, description="Email required")
    
    subscriber = NewsletterSubscriber.query.filter_by(email=email).first()
    if subscriber:
        db.session.delete(subscriber)
        db.session.commit()
        return jsonify(message="Unsubscribed successfully")
    return jsonify(message="Email not found"), 404

@app.route('/api/admin/ads', methods=['GET'])
@role_required('admin')
def admin_list_ads():
    ads = Advertisement.query.order_by(Advertisement.priority.desc()).all()
    return jsonify([a.to_dict() for a in ads])

@app.route('/api/admin/ads', methods=['POST'])
@role_required('admin')
def admin_create_ad():
    data = request.json or {}
    
    start_date = None
    if data.get('start_date'):
        try:
            start_date = datetime.fromisoformat(data.get('start_date'))
        except: pass
        
    end_date = None
    if data.get('end_date'):
        try:
            end_date = datetime.fromisoformat(data.get('end_date'))
        except: pass

    ad = Advertisement(
        title=data.get('title'),
        text=data.get('text'),
        image_url=data.get('image_url'),
        footer_logo_url=data.get('footer_logo_url'),
        target_url=data.get('target_url'),
        position=data.get('position', 'home_banner'),
        priority=int(data.get('priority', 0)),
        is_active=data.get('is_active', True),
        start_date=start_date,
        end_date=end_date,
        target_roles=data.get('target_roles'),
        product_id=data.get('product_id') # New field
    )
    db.session.add(ad)
    db.session.commit()
    return jsonify(ad.to_dict()), 201

@app.route('/api/admin/ads/<int:ad_id>', methods=['PUT'])
@role_required('admin')
def admin_update_ad(ad_id):
    ad = Advertisement.query.get_or_404(ad_id)
    data = request.json or {}
    
    if 'title' in data: ad.title = data['title']
    if 'text' in data: ad.text = data['text']
    if 'image_url' in data: ad.image_url = data['image_url']
    if 'footer_logo_url' in data: ad.footer_logo_url = data['footer_logo_url']
    if 'target_url' in data: ad.target_url = data['target_url']
    if 'position' in data: ad.position = data['position']
    if 'priority' in data: ad.priority = int(data['priority'])
    if 'is_active' in data: ad.is_active = bool(data['is_active'])
    if 'target_roles' in data: ad.target_roles = data['target_roles']
    if 'product_id' in data: ad.product_id = data.get('product_id')
    
    if 'start_date' in data:
        if data['start_date']:
            try:
                ad.start_date = datetime.fromisoformat(data['start_date'])
            except: pass
        else:
            ad.start_date = None
            
    if 'end_date' in data:
        if data['end_date']:
            try:
                ad.end_date = datetime.fromisoformat(data['end_date'])
            except: pass
        else:
            ad.end_date = None
    
    db.session.commit()
    return jsonify(ad.to_dict())

@app.route('/api/admin/ads/<int:ad_id>', methods=['DELETE'])
@role_required('admin')
def admin_delete_ad(ad_id):
    ad = Advertisement.query.get_or_404(ad_id)
    db.session.delete(ad)
    db.session.commit()
    return jsonify(message="Ad deleted")


# -------------------
# Seller Routes
# -------------------
@app.route('/api/seller/dashboard/stats', methods=['GET'])
@role_required('seller', 'admin')
def seller_dashboard():
    user_id = get_jwt_identity()
    products = Product.query.filter_by(seller_id=user_id).count()
    orders = OrderItem.query.filter_by(seller_id=user_id).count()
    total_sales = db.session.query(db.func.sum(OrderItem.subtotal)) \
        .filter_by(seller_id=user_id).scalar() or 0
    return jsonify({
        "product_count": products,
        "pending_orders": orders, # Simplified for example
        "total_sales": total_sales
    })


@app.route('/api/seller/products', methods=['GET'])
@role_required('seller', 'admin')
def seller_products():
    user_id = get_jwt_identity()
    prods = Product.query.filter_by(seller_id=user_id).all()
    return jsonify([p.to_dict() for p in prods])


@app.route('/api/seller/products', methods=['POST'])
@role_required('seller', 'admin')
def seller_add_product():
    user_id = get_jwt_identity()
    # Accept either JSON or multipart/form-data (with multiple images under 'images')
    if request.content_type and request.content_type.startswith('multipart/'):
        form = request.form
        files = request.files.getlist('images')
        name = form.get('name')
        description = form.get('description', '')
        price = form.get('price')
        category_id = form.get('category_id')
        stock_qty = form.get('stock_qty', 0)
        brand = form.get('brand')
        specifications = form.get('specifications')
    else:
        data = request.json or {}
        files = []
        name = data.get('name')
        description = data.get('description', '')
        price = data.get('price')
        category_id = data.get('category_id')
        stock_qty = data.get('stock_qty', 0)
        brand = data.get('brand')
        specifications = data.get('specifications')

    # Basic validation
    if not all([name, price, category_id]):
        abort(400, description="Missing fields")

    # Cast numeric fields
    try:
        price = float(price)
    except Exception:
        abort(400, description='Invalid price')
    try:
        category_id = int(category_id)
    except Exception:
        abort(400, description='Invalid category_id')
    try:
        stock_qty = int(stock_qty or 0)
    except Exception:
        stock_qty = 0
        
    # Parse specifications if string (from form-data)
    if isinstance(specifications, str):
        import json
        try:
            specifications = json.loads(specifications)
        except:
            specifications = {}

    product = Product(
        seller_id=user_id,
        category_id=category_id,
        name=name,
        description=description,
        price=price,
        status='pending',
        brand=brand,
        specifications=specifications
    )

    db.session.add(product)
    db.session.flush()

    inventory = Inventory(product_id=product.id, stock_qty=stock_qty)
    db.session.add(inventory)

    # Save uploaded images (if any) and link via ProductImage
    saved_file_records = []
    try:
        for idx, f in enumerate(files or []):
            if not f or f.filename == '':
                continue
            filename = secure_filename(f.filename)
            unique_name = f"{uuid4().hex}_{filename}"
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
            f.save(save_path)
            size = os.path.getsize(save_path)
            frec = File(owner_id=user_id, filename=filename, stored_filename=unique_name, filepath=save_path, size=size, status='active')
            db.session.add(frec)
            db.session.flush()
            saved_file_records.append(frec)
            # link
            pi = ProductImage(product_id=product.id, file_id=frec.id, position=idx)
            db.session.add(pi)

        # Commit product, inventory, file records and links
        db.session.commit()
        return jsonify(product=product.to_dict()), 201
    except Exception as e:
        # On failure, rollback and clean up any files written to disk
        db.session.rollback()
        for frec in saved_file_records:
            try:
                if os.path.exists(frec.filepath):
                    os.remove(frec.filepath)
            except Exception:
                pass
        # If product was created in db.session but rolled back, nothing to delete further
        abort(500, description=str(e))


@app.route('/api/seller/products/<int:product_id>', methods=['PUT'])
@role_required('seller', 'admin')
def seller_edit_product(product_id):
    user_id = get_jwt_identity()
    claims = get_jwt()
    is_admin = claims.get('role') == 'admin'
    
    query = Product.query.filter_by(id=product_id)
    if not is_admin:
        query = query.filter_by(seller_id=user_id)
        
    product = query.first_or_404()
    
    data = request.json or {}
    
    if 'name' in data:
        product.name = data['name']
    if 'description' in data:
        product.description = data['description']
    if 'price' in data:
        try:
            product.price = float(data['price'])
        except:
            pass
            
    if 'quantity' in data:
        try:
            qty = int(data['quantity'])
            if product.inventory:
                product.inventory.stock_qty = qty
            else:
                 inv = Inventory(product_id=product.id, stock_qty=qty)
                 db.session.add(inv)
        except:
            pass

    db.session.commit()
    return jsonify(product.to_dict())


@app.route('/api/seller/products/<int:product_id>/stock', methods=['PUT'])
@role_required('seller', 'admin')
def seller_update_stock(product_id):
    user_id = get_jwt_identity()
    product = Product.query.filter_by(id=product_id, seller_id=user_id).first_or_404()
    data = request.json or {}
    new_stock = int(data.get('stock'))
    product.inventory.stock_qty = new_stock
    db.session.commit()
    return jsonify(message="Stock updated")

@app.route('/api/seller/inventory', methods=['GET'])
@role_required('seller', 'admin')
def seller_inventory():
    user_id = get_jwt_identity()
    prods = Product.query.filter_by(seller_id=user_id).all()
    return jsonify([p.to_dict() for p in prods])

@app.route('/api/seller/orders', methods=['GET'])
@role_required('seller', 'admin')
def seller_orders():
    user_id = get_jwt_identity()
    items = OrderItem.query.filter_by(seller_id=user_id).all()
    result = []
    for i in items:
        result.append({
            "order_id": i.order_id,
            "product_name": i.product.name,
            "quantity": i.quantity,
            "price": i.price,
            "status": i.order.status
        })
    return jsonify(result)


@app.route('/api/seller/bank-details', methods=['GET', 'POST'])
@role_required('seller', 'admin')
def seller_bank_details():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)

    if request.method == 'GET':
        return jsonify({
            "bank_account_number": user.bank_account_number,
            "bank_ifsc": user.bank_ifsc,
            "bank_beneficiary_name": user.bank_beneficiary_name,
            "upi_id": user.upi_id,
            "preferred_payout_method": user.preferred_payout_method
        })

    data = request.json or {}
    user.bank_account_number = data.get('bank_account_number')
    user.bank_ifsc = data.get('bank_ifsc')
    user.bank_beneficiary_name = data.get('bank_beneficiary_name')
    user.upi_id = data.get('upi_id')
    user.preferred_payout_method = data.get('preferred_payout_method', 'bank')
    
    # Clear razorpay IDs if bank details change to force re-creation
    # Note: In a real system, we might want to keep old ones or manage multiple fund accounts.
    # Here we reset to force creation of the new one.
    user.razorpay_fund_account_id = None 
    # user.razorpay_contact_id = None # Contact info (email/phone) rarely changes, so we can keep it.

    db.session.commit()
    return jsonify({"message": "Payout details saved successfully"})


@app.route('/api/seller/withdrawals', methods=['GET'])
@role_required('seller', 'admin')
def seller_withdrawals():
    user_id = get_jwt_identity()
    reqs = WithdrawalRequest.query.filter_by(seller_id=user_id).order_by(WithdrawalRequest.requested_at.desc()).all()
    
    # Calculate total sales
    total_sales = db.session.query(db.func.sum(OrderItem.subtotal)).filter_by(seller_id=user_id).scalar() or 0
    
    # Calculate already withdrawn/requested amount (excluding rejected and cancelled)
    withdrawn_amount = db.session.query(db.func.sum(WithdrawalRequest.amount)).filter(
        WithdrawalRequest.seller_id == user_id,
        WithdrawalRequest.status != 'rejected',
        WithdrawalRequest.status != 'cancelled'
    ).scalar() or 0
    
    available_balance = total_sales - withdrawn_amount
    
    user = User.query.get(user_id)
    # Configured if (Bank Details present) OR (UPI ID present)
    has_bank = all([user.bank_account_number, user.bank_ifsc, user.bank_beneficiary_name])
    has_upi = bool(user.upi_id)
    bank_details_configured = has_bank or has_upi

    response = {
        "balance": available_balance,
        "total_withdrawn": withdrawn_amount,
        "bank_details_configured": bank_details_configured,
        "has_bank": has_bank,
        "has_upi": has_upi,
        "withdrawals": [
            {
                "id": r.id,
                "amount": r.amount,
                "status": r.status,
                "created_at": r.requested_at.isoformat(),
                "rejection_reason": r.rejection_reason
            }
            for r in reqs
        ]
    }
    return jsonify(response)


@app.route('/api/seller/withdrawals/request', methods=['POST'])
@role_required('seller', 'admin')
def seller_request_withdrawal():
    user_id = get_jwt_identity()
    data = request.json or {}
    
    # Calculate available balance
    total_sales = db.session.query(db.func.sum(OrderItem.subtotal)).filter_by(seller_id=user_id).scalar() or 0
    withdrawn_amount = db.session.query(db.func.sum(WithdrawalRequest.amount)).filter(
        WithdrawalRequest.seller_id == user_id,
        WithdrawalRequest.status != 'rejected',
        WithdrawalRequest.status != 'cancelled'
    ).scalar() or 0
    available_balance = total_sales - withdrawn_amount

    # Determine requested amount
    requested_amount = data.get('amount')
    if requested_amount is not None:
        try:
            amount = float(requested_amount)
        except ValueError:
            abort(400, description="Invalid amount format")
    else:
        amount = available_balance

    if amount <= 0:
        abort(400, description="Invalid amount or insufficient balance")
        
    if amount > available_balance + 0.01: # Small buffer for float precision
        abort(400, description="Insufficient balance")
    
    payment_method = data.get('payment_method')
    payment_details = data.get('payment_details')

    # Calculate due date: Next 11:00 AM
    now = datetime.utcnow()
    target_time = now.replace(hour=11, minute=0, second=0, microsecond=0)
    if now >= target_time:
        target_time += timedelta(days=1)
        
    wr = WithdrawalRequest(
        seller_id=user_id,
        amount=amount,
        status='requested',
        requested_at=now,
        due_date=target_time
    )
    db.session.add(wr)
    db.session.commit()

    # If seller supplied preferred payment method/details
    if payment_method or payment_details:
        # Create a "pending" payment record acting as preference
        pr = PaymentRecord(
            withdrawal_id=wr.id, 
            amount=amount, 
            method=payment_method, 
            details=str(payment_details), 
            paid_at=None, 
            admin_id=None
        )
        db.session.add(pr)
        db.session.commit()

    return jsonify(id=wr.id, status=wr.status, due_date=target_time.isoformat())


@app.route('/api/seller/withdrawals/<int:id>/cancel', methods=['POST'])
@role_required('seller', 'admin')
def seller_cancel_withdrawal(id):
    user_id = get_jwt_identity()
    wr = WithdrawalRequest.query.filter_by(id=id, seller_id=user_id).first_or_404()
    
    if wr.status != 'requested':
        abort(400, description="Cannot cancel withdrawal that is not in requested state")
        
    wr.status = 'cancelled'
    db.session.commit()
    return jsonify(message="Withdrawal cancelled", balance=get_seller_balance(user_id))

def get_seller_balance(user_id):
    total_sales = db.session.query(db.func.sum(OrderItem.subtotal)).filter_by(seller_id=user_id).scalar() or 0
    withdrawn_amount = db.session.query(db.func.sum(WithdrawalRequest.amount)).filter(
        WithdrawalRequest.seller_id == user_id,
        WithdrawalRequest.status != 'rejected',
        WithdrawalRequest.status != 'cancelled'
    ).scalar() or 0
    return total_sales - withdrawn_amount

@app.route('/api/seller/transactions', methods=['GET'])
@role_required('seller', 'admin')
def seller_transactions():
    user_id = get_jwt_identity()
    
    # 1. Sales (Credits) - Only consider orders that are valid (paid/cod pending is debatable, usually paid)
    # For balance calc we used OrderItem.subtotal without filtering by order status in previous code? 
    # Let's check seller_withdrawals... yes, simple sum. We should probably restrict to paid orders, but let's match existing logic for consistency first.
    # Ideally: Filter by Order.payment_status == 'paid' OR Order.payment_gateway == 'cod' (and status delivered?)
    # To stay consistent with current balance logic: ALL order items.
    
    sales = db.session.query(
        OrderItem.id, 
        OrderItem.subtotal, 
        OrderItem.created_at, # OrderItem doesn't have created_at, Order does.
        Order.created_at.label('date'),
        Product.name
    ).join(Order).join(Product).filter(OrderItem.seller_id == user_id).all()
    
    # 2. Withdrawals (Debits)
    withdrawals = WithdrawalRequest.query.filter_by(seller_id=user_id).all()
    
    transactions = []
    
    for s in sales:
        # We need a date. OrderItem doesn't have it, join Order.
        transactions.append({
            "id": f"sale-{s.id}",
            "type": "credit",
            "amount": s.subtotal,
            "date": s.date.isoformat(),
            "description": f"Sale: {s.name}",
            "status": "completed"
        })
        
    for w in withdrawals:
        transactions.append({
            "id": f"withdraw-{w.id}",
            "type": "debit",
            "amount": w.amount,
            "date": w.requested_at.isoformat(),
            "description": f"Withdrawal Request #{w.id}",
            "status": w.status
        })
        
    # Sort by date desc
    transactions.sort(key=lambda x: x['date'], reverse=True)
    
    return jsonify(transactions)

@app.route('/api/seller/profile', methods=['GET'])
@role_required('seller', 'admin')
def get_seller_profile():
    """
    Returns the full profile for the logged-in seller, including GST and Address.
    """
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())


@app.route('/api/seller/billing/purchase', methods=['POST'])
@role_required('seller', 'admin')
def seller_add_purchase_bill():
    user_id = get_jwt_identity()
    data = request.json or {}
    bill = SellerPurchaseBill(
        seller_id=user_id,
        supplier_name=data.get('supplier_name'),
        bill_number=data.get('bill_number'),
        total_amount=data.get('total_amount'),
        bill_date=datetime.fromisoformat(data.get('bill_date')) if data.get('bill_date') else datetime.utcnow()
    )
    db.session.add(bill)
    db.session.commit()
    return jsonify(message="Purchase bill added")


@app.route('/api/seller/billing/sales', methods=['GET'])
@role_required('seller', 'admin')
def seller_sales_bills():
    user_id = get_jwt_identity()
    bills = SellerSalesBill.query.filter_by(seller_id=user_id).all()
    return jsonify([
        {
            "id": b.id,
            "order_id": b.order_id,
            "bill_number": b.bill_number,
            "total_amount": b.total_amount,
            "bill_date": b.bill_date.isoformat()
        }
        for b in bills
    ])


# -------------------
# User Routes (cart, wishlist, orders, payments)
# -------------------
@app.route('/api/user/cart', methods=['GET'])
@jwt_required()
def get_cart():
    user_id = get_jwt_identity()
    cart = Cart.query.filter_by(user_id=user_id).first()
    if not cart:
        return jsonify({"items": [], "total": 0, "discount": 0, "final_total": 0})
    
    items = []
    total = 0
    for item in cart.items:
        items.append({
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product.name,
            "price": item.product.price,
            "mrp": item.product.mrp,
            "quantity": item.quantity,
            "image": item.product.product_images[0].file.filepath if item.product.product_images else None,
            "image_url": f"/api/files/{item.product.product_images[0].file.id}/download" if item.product.product_images else None,
            "seller_id": item.product.seller_id
        })
        total += item.product.price * item.quantity

    discount = 0
    coupon_data = None

    if cart.coupon_code:
        coupon = Coupon.query.filter_by(code=cart.coupon_code, is_active=True).first()
        # Basic validation (expiry, limits) should be done here or in apply logic.
        # Doing it here ensures we don't apply invalid coupons if state changed.
        is_valid = True
        if not coupon: is_valid = False
        elif coupon.expiry_date and coupon.expiry_date < datetime.utcnow(): is_valid = False
        elif coupon.usage_limit > 0 and coupon.used_count >= coupon.usage_limit: is_valid = False
        elif coupon.min_order_value > 0 and total < coupon.min_order_value: is_valid = False
        
        if is_valid:
            if coupon.type == 'admin':
                # Global discount
                discount = (total * coupon.discount_percent) / 100
            elif coupon.type == 'seller' and coupon.seller_id:
                # Discount only on items from this seller
                seller_total = sum(item['price'] * item['quantity'] for item in items if item['seller_id'] == coupon.seller_id)
                discount = (seller_total * coupon.discount_percent) / 100
            
            if coupon.max_discount_amount and discount > coupon.max_discount_amount:
                discount = coupon.max_discount_amount
            
            coupon_data = {
                "code": coupon.code,
                "discount_percent": coupon.discount_percent,
                "type": coupon.type
            }
        else:
             # Auto-remove invalid coupon
             cart.coupon_code = None
             db.session.commit()

    final_total = max(0, total - discount)

    return jsonify({
        "items": items,
        "total": total,
        "discount": discount,
        "coupon": coupon_data,
        "final_total": final_total
    })


@app.route('/api/user/cart/items', methods=['POST'])
@jwt_required()
def add_to_cart():
    user_id = get_jwt_identity()
    data = request.json or {}
    product_id = data.get('product_id')
    quantity = int(data.get('quantity', 1))
    product = Product.query.get_or_404(product_id)
    if product.status != 'approved':
        abort(400, description="Product not available")
    cart = get_or_create_cart(user_id)
    existing = CartItem.query.filter_by(cart_id=cart.id, product_id=product_id).first()
    if existing:
        existing.quantity += quantity
    else:
        ci = CartItem(cart_id=cart.id, product_id=product_id, quantity=quantity)
        db.session.add(ci)
    db.session.commit()
    return jsonify(message="Added to cart")


@app.route('/api/user/cart/items/<int:item_id>', methods=['DELETE'])
@jwt_required()
def remove_from_cart(item_id):
    user_id = get_jwt_identity()
    cart = get_or_create_cart(user_id)
    item = CartItem.query.filter_by(id=item_id, cart_id=cart.id).first_or_404()
    db.session.delete(item)
    db.session.commit()
    return jsonify(message="Removed from cart")


@app.route('/api/user/wishlist', methods=['GET'])
@jwt_required()
def get_wishlist():
    user_id = get_jwt_identity()
    wl = get_or_create_wishlist(user_id)
    items = []
    for i in wl.items:
        product_dict = i.product.to_dict() # Use product.to_dict to get all details including images
        items.append({
            "id": i.id, 
            "product": {
                "id": i.product.id, 
                "name": i.product.name, 
                "price": i.product.price,
                "images": product_dict.get('images', []) # Include images
            }
        })
    return jsonify(items)


@app.route('/api/user/wishlist', methods=['POST'])
@jwt_required()
def add_wishlist_item():
    user_id = get_jwt_identity()
    data = request.json or {}
    product_id = data.get('product_id')
    wl = get_or_create_wishlist(user_id)
    existing = WishlistItem.query.filter_by(wishlist_id=wl.id, product_id=product_id).first()
    if existing:
        return jsonify(message="Already in wishlist")
    wi = WishlistItem(wishlist_id=wl.id, product_id=product_id)
    db.session.add(wi)
    db.session.commit()
    return jsonify(message="Added to wishlist")


@app.route('/api/user/wishlist/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete_wishlist_item(product_id):
    user_id = get_jwt_identity()
    wl = get_or_create_wishlist(user_id)
    item = WishlistItem.query.filter_by(product_id=product_id, wishlist_id=wl.id).first_or_404()
    db.session.delete(item)
    db.session.commit()
    return jsonify(message="Removed from wishlist")


@app.route('/api/user/addresses', methods=['GET'])
@jwt_required()
def get_user_addresses():
    user_id = get_jwt_identity()
    addresses = Address.query.filter_by(user_id=user_id).all()
    return jsonify([a.to_dict() for a in addresses])


@app.route('/api/user/addresses', methods=['POST'])
@jwt_required()
def add_user_address():
    user_id = get_jwt_identity()
    data = request.json or {}
    
    if not all([data.get('address_line_1'), data.get('city'), data.get('state'), data.get('postal_code')]):
        abort(400, description="Missing required fields")

    address = Address(
        user_id=user_id,
        address_line_1=data.get('address_line_1'),
        city=data.get('city'),
        state=data.get('state'),
        postal_code=data.get('postal_code'),
        country=data.get('country', 'India')
    )
    db.session.add(address)
    db.session.commit()
    return jsonify(address.to_dict()), 201


@app.route('/api/user/addresses/<int:address_id>', methods=['DELETE'])
@jwt_required()
def delete_user_address(address_id):
    user_id = get_jwt_identity()
    # Filter by user_id to ensure ownership
    # Cast user_id to int just in case, although get_jwt_identity typically returns string from our login logic
    try:
        uid = int(user_id)
    except:
        uid = user_id
        
    address = Address.query.filter_by(id=address_id, user_id=uid).first_or_404()
    db.session.delete(address)
    db.session.commit()
    return jsonify(message="Address deleted")

@app.route('/api/user/addresses/<int:address_id>/set-default', methods=['PUT'])
@jwt_required()
def set_default_address(address_id):
    user_id = get_jwt_identity()
    uid = int(user_id)

    # First, clear any existing default for this user
    Address.query.filter_by(user_id=uid, is_default=True).update({Address.is_default: False})
    
    # Then, set the specified address as default
    address = Address.query.filter_by(id=address_id, user_id=uid).first_or_404()
    address.is_default = True
    db.session.commit()
    return jsonify(address.to_dict())

# -------------------
# Orders + Multi-gateway Payments
# -------------------
@app.route('/api/user/orders', methods=['POST'])
@jwt_required()
def create_order():
    user_id = int(get_jwt_identity())
    data = request.json or {}
    gateway = data.get('payment_method', 'cod')  # Match frontend

    cart = get_or_create_cart(user_id)
    if not cart.items:
        abort(400, description="Cart is empty")

    try:
        # 1. Create local order
        order = Order(user_id=user_id, status='pending', payment_status='unpaid', payment_gateway=gateway)
        db.session.add(order)
        db.session.flush() # Get order.id

        total = 0
        for item in cart.items:
            product = item.product
            if product.status != 'approved':
                raise ValueError("Product not available")
            # reserve stock
            decrease_stock(product.id, item.quantity)
            subtotal = product.price * item.quantity
            oi = OrderItem(
                order_id=order.id,
                product_id=product.id,
                seller_id=product.seller_id,
                quantity=item.quantity,
                price=product.price,
                subtotal=subtotal
            )
            db.session.add(oi)
            total += subtotal

        order.total_amount = total
        
        # Create invoice HTML
        invoice_items = []
        for oi in order.items:
            invoice_items.append(f"<tr><td>{oi.product.name}</td><td>{oi.quantity}</td><td>{oi.price:.2f}</td><td>{oi.subtotal:.2f}</td></tr>")
        invoice_html = f"""
        <html><head><meta charset='utf-8'><title>Invoice {order.id}</title></head><body>
        <h2>Invoice #{order.id}</h2>
        <div>Customer: {order.user.name} &lt;{order.user.email}&gt;</div>
        <div>Date: {order.created_at.isoformat()}</div>
        <table border='1' cellpadding='6' cellspacing='0' style='border-collapse:collapse;margin-top:10px;'>
        <thead><tr><th>Product</th><th>Qty</th><th>Unit</th><th>Subtotal</th></tr></thead>
        <tbody>{''.join(invoice_items)}</tbody>
        </table>
        <div style='margin-top:10px;font-weight:bold;'>Total: {order.total_amount:.2f}</div>
        </body></html>
        """
        order.invoice_html = invoice_html

        # 2. Handle Gateway specific setup (BEFORE clearing cart/committing)
        response_data = {"order_id": order.id}

        if gateway == "cod" or gateway == "pay_later":
            order.status = "pending_payment" # Renamed status per requirements
            order.payment_status = "unpaid"
            order.payment_gateway = gateway # Set to 'cod' or 'pay_later' as submitted
            response_data["message"] = "Order placed successfully. Payment is pending."
            response_data["pg"] = gateway # Reflect the chosen gateway in response

        elif gateway == "razorpay" or gateway == "upi":
            if not razorpay_client:
                raise ValueError("Razorpay client not initialized")
            rp_order = razorpay_client.order.create({
                "amount": int(total * 100),
                "currency": "INR",
                "receipt": str(order.id),
                "payment_capture": 1,
                "notes": {
                    "payment_mode": "upi" if gateway == "upi" else "all"
                }
            })
            order.payment_reference = rp_order["id"]
            response_data.update({
                "pg": "razorpay",
                "amount": total,
                "currency": "INR",
                "razorpay_order_id": rp_order["id"],
                "razorpay_key": RAZORPAY_KEY_ID,
                "method_preference": "upi" if gateway == "upi" else None
            })

        elif gateway == "stripe":
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[
                    {
                        "price_data": {
                            "currency": "usd",
                            "product_data": {"name": f"Order {order.id}"},
                            "unit_amount": int(total * 100),
                        },
                        "quantity": 1,
                    }
                ],
                mode="payment",
                success_url="http://localhost:5173/payment-status?success=true",
                cancel_url="http://localhost:5173/payment-status?success=false",
            )
            order.payment_reference = checkout_session.id
            response_data.update({
                "pg": "stripe",
                "checkout_session_id": checkout_session.id,
                "checkout_url": checkout_session.url,
            })

        elif gateway == "paytm":
            paytm_url = f"https://securegw-stage.paytm.in/theia/processTransaction?ORDER_ID={order.id}"
            response_data.update({
                "pg": "paytm",
                "amount": total,
                "redirect_url": paytm_url,
            })

        elif gateway == "phonepe":
            phonepe_url = f"https://api.phonepe.com/apis/pg/v1/pay?merchantTransactionId={order.id}"
            response_data.update({
                "pg": "phonepe",
                "amount": total,
                "redirect_url": phonepe_url,
            })

        else:
            raise ValueError("Unsupported payment gateway")

        # 3. Success - Clear cart and commit
        for item in list(cart.items):
            db.session.delete(item)
        
        db.session.commit()

        # Emit socket event for real-time updates (e.g. admin dashboard)
        emit_update('order', 'created', {
            "id": order.id,
            "user_id": user_id,
            "total": total,
            "status": order.status
        })

        return jsonify(response_data)

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Order creation failed: {e}")
        abort(400, description=str(e))


@app.route('/api/orders/<int:order_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_order(order_id):
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    if order.status == 'cancelled':
        abort(400, description="Already cancelled")
    if order.status not in ['pending', 'paid']:
        abort(400, description="Cannot cancel now")
    for item in order.items:
        increase_stock(item.product_id, item.quantity)
    order.status = 'cancelled'
    order.payment_status = 'refunded'
    db.session.commit()
    return jsonify(order_id=order.id, status=order.status)


@app.route('/api/user/orders', methods=['GET'])
@jwt_required()
def list_user_orders():
    user_id = int(get_jwt_identity())
    limit = request.args.get('limit', type=int)
    query = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc())
    if limit:
        query = query.limit(limit)
    orders = query.all()
    result = []
    for o in orders:
        items = []
        for i in o.items:
            items.append({
                "product_id": i.product_id,
                "product_name": i.product.name,
                "quantity": i.quantity
            })
        result.append({
            "id": o.id,
            "total_amount": o.total_amount,
            "status": o.status,
            "payment_status": o.payment_status,
            "created_at": o.created_at.isoformat(),
            "total": o.total_amount, # Match frontend
            "items": items
        })
    return jsonify(result)

# New route for payment status page
@app.route('/api/user/orders/<int:order_id>', methods=['GET'])
@jwt_required()
def get_user_order(order_id):
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    
    # Tracking Mock (Simulate API)
    tracking_info = {
        "provider": "Internal",
        "tracking_id": f"TRK{order.id}XYZ",
        "status": "Processing" if order.status == 'paid' else order.status,
        "estimated_delivery": (order.created_at + timedelta(days=5)).strftime('%Y-%m-%d'),
        "history": [
            {"status": "Order Placed", "timestamp": order.created_at.isoformat()}
        ]
    }
    if order.status in ['shipped', 'delivered']:
        tracking_info["history"].append({"status": "Shipped", "timestamp": (order.created_at + timedelta(days=1)).isoformat()})
    if order.status == 'delivered':
        tracking_info["history"].append({"status": "Delivered", "timestamp": (order.created_at + timedelta(days=3)).isoformat()})

    items = []
    for i in order.items:
        items.append({
            "product_name": i.product.name,
            "quantity": i.quantity,
            "price": i.price,
            "subtotal": i.subtotal
        })

    return jsonify({
        "id": order.id,
        "status": order.status,
        "payment_status": order.payment_status,
        "total_amount": order.total_amount,
        "created_at": order.created_at.isoformat(),
        "delivery_info": order.delivery_info,
        "tracking": tracking_info,
        "items": items
    })

@app.route('/api/user/orders/<int:order_id>/retry', methods=['POST'])
@jwt_required()
def retry_order(order_id):
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    
    if order.payment_status == 'paid':
        return jsonify({"message": "Order already paid", "order_id": order.id})

    data = request.json or {}
    gateway = data.get('payment_method', order.payment_gateway)
    
    # Update gateway if changed
    order.payment_gateway = gateway
    db.session.commit()

    response_data = {"order_id": order.id}
    total = order.total_amount

    try:
        if gateway == "cod":
            order.status = "pending" # COD orders start as pending, payment is on delivery
            order.payment_status = "cod"
            db.session.commit()
            response_data["message"] = "Order placed successfully with COD"

        elif gateway == "razorpay":
            if not razorpay_client:
                abort(500, description="Razorpay not configured")
            
            # Create NEW razorpay order for retry to ensure clean state
            rp_order = razorpay_client.order.create({
                "amount": int(total * 100),
                "currency": "INR",
                "receipt": str(order.id),
                "payment_capture": 1,
            })
            order.payment_reference = rp_order["id"]
            db.session.commit()
            
            response_data.update({
                "pg": "razorpay",
                "amount": total,
                "currency": "INR",
                "razorpay_order_id": rp_order["id"],
                "razorpay_key": RAZORPAY_KEY_ID,
            })
        
        # Add other gateways (stripe/etc) if needed similar to create_order
        
        return jsonify(response_data)

    except Exception as e:
        app.logger.error(f"Retry failed: {e}")
        abort(400, description=str(e))


@app.route('/api/user/orders/<int:order_id>/invoice', methods=['GET'])
@jwt_required()
def get_user_order_invoice(order_id):
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    if not order.invoice_html:
        abort(404, description='Invoice not found')
    resp = app.response_class(order.invoice_html, mimetype='text/html')
    resp.headers['Content-Disposition'] = f'inline; filename=invoice_{order.id}.html'
    return resp


# Convenience routes without the `/api` prefix to support alternative clients
@app.route('/order/<int:order_id>', methods=['GET'])
@jwt_required()
def order_detail(order_id):
    # Allow admin to view any order, sellers to view orders that include their items, and users their own orders
    claims = get_jwt()
    role = claims.get('role')
    user_id = int(get_jwt_identity())
    order = Order.query.get_or_404(order_id)
    if role == 'admin':
        pass
    elif role == 'seller':
        has_item = OrderItem.query.filter_by(order_id=order.id, seller_id=user_id).first()
        if not has_item:
            abort(403, description='Forbidden')
    else:
        if order.user_id != user_id:
            abort(403, description='Forbidden')
    return jsonify({
        "id": order.id,
        "status": order.status,
        "payment_status": order.payment_status,
        "total_amount": order.total_amount,
        "created_at": order.created_at.isoformat(),
        "delivery_info": order.delivery_info,
    })


@app.route('/order/<int:order_id>/track', methods=['GET'])
@jwt_required()
def order_track(order_id):
    # Return simple tracking/delivery info
    claims = get_jwt()
    role = claims.get('role')
    user_id = int(get_jwt_identity())
    order = Order.query.get_or_404(order_id)
    if role == 'admin':
        pass
    elif role == 'seller':
        has_item = OrderItem.query.filter_by(order_id=order.id, seller_id=user_id).first()
        if not has_item:
            abort(403, description='Forbidden')
    else:
        if order.user_id != user_id:
            abort(403, description='Forbidden')
    return jsonify({
        "order_id": order.id,
        "status": order.status,
        "delivery_info": order.delivery_info,
    })


@app.route('/order/<int:order_id>/invoice', methods=['GET'])
@jwt_required()
def order_invoice_public(order_id):
    # Serve the invoice HTML similar to /api/user/orders/<id>/invoice
    claims = get_jwt()
    role = claims.get('role')
    user_id = int(get_jwt_identity())
    order = Order.query.get_or_404(order_id)
    if role == 'admin':
        pass
    elif role == 'seller':
        has_item = OrderItem.query.filter_by(order_id=order.id, seller_id=user_id).first()
        if not has_item:
            abort(403, description='Forbidden')
    else:
        if order.user_id != user_id:
            abort(403, description='Forbidden')
    if not order.invoice_html:
        abort(404, description='Invoice not found')
    resp = app.response_class(order.invoice_html, mimetype='text/html')
    resp.headers['Content-Disposition'] = f'inline; filename=invoice_{order.id}.html'
    return resp


@app.route('/api/orders/<int:order_id>/status', methods=['PUT'])
@role_required('seller', 'admin')
def update_order_status(order_id):
    data = request.json or {}
    new_status = data.get('status')
    delivery_info = data.get('delivery_info')
    if not new_status:
        abort(400, description='Missing status')
    order = Order.query.get_or_404(order_id)
    # Authorization: sellers can only update orders that include their items
    claims = get_jwt()
    if claims.get('role') == 'seller':
        seller_id = get_jwt_identity()
        # ensure seller has items in order
        has_item = OrderItem.query.filter_by(order_id=order.id, seller_id=seller_id).first()
        if not has_item:
            abort(403, description='Forbidden: not your order')
    order.status = new_status
    if delivery_info:
        order.delivery_info = delivery_info
    db.session.commit()
    return jsonify(id=order.id, status=order.status, delivery_info=order.delivery_info)



# -------------------
# Payment Initiation
# -------------------
@app.route('/api/payments/initiate/razorpay', methods=['POST'])
@jwt_required()
def initiate_razorpay():
    data = request.json or {}
    order_id = data.get('order_id')
    if not order_id:
        abort(400, description="Missing order_id")
    
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    
    if order.payment_status == 'paid':
        return jsonify({"message": "Order already paid", "order_id": order.id})

    try:
        if not razorpay_client:
             raise Exception("Razorpay not configured")
             
        rp_order = razorpay_client.order.create({
            "amount": int(order.total_amount * 100), # paise
            "currency": "INR",
            "receipt": str(order.id),
            "payment_capture": 1,
            "notes": {"order_id": order.id}
        })
        
        order.payment_gateway = 'razorpay'
        order.payment_reference = rp_order["id"]
        db.session.commit()
        
        return jsonify({
            "id": rp_order["id"],
            "amount": rp_order["amount"],
            "currency": rp_order["currency"],
            "key_id": RAZORPAY_KEY_ID
        })
    except Exception as e:
        app.logger.error(f"Razorpay Init Error: {e}")
        abort(500, description=str(e))

@app.route('/api/payments/initiate/stripe', methods=['POST'])
@jwt_required()
def initiate_stripe():
    data = request.json or {}
    order_id = data.get('order_id')
    if not order_id:
        abort(400, description="Missing order_id")
    
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    
    if order.payment_status == 'paid':
        return jsonify({"message": "Order already paid", "order_id": order.id})

    try:
        if not STRIPE_SECRET_KEY:
             raise Exception("Stripe not configured")
        
        stripe.api_key = STRIPE_SECRET_KEY
        
        # Create PaymentIntent
        intent = stripe.PaymentIntent.create(
            amount=int(order.total_amount * 100), # cents/paise
            currency='inr',
            metadata={'order_id': order.id},
            automatic_payment_methods={'enabled': True},
        )
        
        order.payment_gateway = 'stripe'
        order.payment_reference = intent['id']
        db.session.commit()
        
        return jsonify({
            "client_secret": intent['client_secret'],
            "publishable_key": os.getenv('STRIPE_PUBLISHABLE_KEY') # You should add this to env
        })
    except Exception as e:
        app.logger.error(f"Stripe Init Error: {e}")
        abort(500, description=str(e))

# -------------------
# Webhooks
# -------------------
@app.route('/api/webhooks/razorpay', methods=['POST'])
def webhook_razorpay():
    # Verify signature
    sig = request.headers.get('X-Razorpay-Signature')
    body = request.data.decode('utf-8')
    webhook_secret = os.getenv('RAZORPAY_WEBHOOK_SECRET')
    
    if not webhook_secret:
        app.logger.warning("Razorpay Webhook Secret not set")
        return jsonify(status='ok') # Acknowledge to stop retries

    try:
        razorpay_client.utility.verify_webhook_signature(body, sig, webhook_secret)
    except Exception:
        app.logger.error("Razorpay Webhook Signature Invalid")
        return jsonify(status='failure'), 400

    event = request.json
    if event.get('event') == 'payment.captured':
        payload = event.get('payload', {}).get('payment', {}).get('entity', {})
        notes = payload.get('notes', {})
        order_id = notes.get('order_id')
        if order_id:
            with app.app_context():
                order = Order.query.get(order_id)
                if order and order.payment_status != 'paid':
                    order.payment_status = 'paid'
                    order.status = 'paid'
                    # Record txn...
                    db.session.commit()
                    # Notify...

    return jsonify(status='ok')

@app.route('/api/webhooks/stripe', methods=['POST'])
def webhook_stripe():
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    webhook_secret = STRIPE_WEBHOOK_SECRET

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError:
        return jsonify(success=False), 400
    except stripe.error.SignatureVerificationError:
        return jsonify(success=False), 400

    if event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        order_id = payment_intent['metadata'].get('order_id')
        if order_id:
             with app.app_context():
                order = Order.query.get(order_id)
                if order:
                    order.payment_status = 'paid'
                    order.status = 'paid'
                    db.session.commit()
    
    return jsonify(success=True)


# -------------------
# User Profile & Auth
# -------------------
@app.route('/api/users/profile', methods=['GET'])
@jwt_required()
def get_user_profile():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())

@app.route('/api/auth/logout', methods=['POST'])
@jwt_required()
def logout_user():
    # Stateless logout
    return jsonify(message="Logged out successfully")

# -------------------
# Admin Notifications
# -------------------
@app.route('/api/admin/notifications', methods=['GET'])
@role_required('admin')
def admin_get_notifications():
    # Return mock notifications or fetch from a DB table if we had one.
    # For now, let's return some system alerts based on data.
    notifications = []
    
    pending_withdrawals = WithdrawalRequest.query.filter_by(status='requested').count()
    if pending_withdrawals > 0:
        notifications.append({
            "id": 1, 
            "type": "warning", 
            "message": f"{pending_withdrawals} withdrawal requests pending approval."
        })
        
    pending_sellers = SellerRequest.query.filter_by(status='requested').count()
    if pending_sellers > 0:
        notifications.append({
             "id": 2,
             "type": "info",
             "message": f"{pending_sellers} new seller requests."
        })

    # Check stock
    low_stock = Inventory.query.filter(Inventory.stock_qty <= Inventory.low_stock_threshold).count()
    if low_stock > 0:
         notifications.append({
             "id": 3,
             "type": "error",
             "message": f"{low_stock} products are running low on stock."
         })

    return jsonify(notifications)


# -------------------
# Payment Verification Endpoints
# -------------------
@app.route('/api/payments/razorpay/verify', methods=['POST'])
@jwt_required()
def verify_razorpay():
    """
    Body should contain:
    {
      "order_id": <local order id>,
      "razorpay_order_id": "...",
      "razorpay_payment_id": "...",
      "razorpay_signature": "..."
    }
    """
    data = request.json or {}
    local_order_id = data.get("order_id")
    rp_order_id = data.get("razorpay_order_id")
    rp_payment_id = data.get("razorpay_payment_id")
    rp_signature = data.get("razorpay_signature")

    if not all([local_order_id, rp_order_id, rp_payment_id, rp_signature]):
        abort(400, description="Missing fields")

    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": rp_order_id,
            "razorpay_payment_id": rp_payment_id,
            "razorpay_signature": rp_signature,
        })
    except razorpay.errors.SignatureVerificationError:
        return jsonify(success=False, message="Signature verification failed"), 400

    order = Order.query.filter_by(id=local_order_id, payment_reference=rp_order_id).first_or_404()
    
    # Idempotency: If already paid, just log and return success
    if order.payment_status == 'paid':
        app.logger.info(f"Payment already verified for Order #{order.id}")
        return jsonify(success=True, order_id=order.id, message="Already paid")

    order.payment_status = "paid"
    order.status = "paid"
    
    # Log Successful Transaction
    txn = PaymentTransaction(
        order_id=order.id,
        amount=order.total_amount,
        payment_status='success',
        payment_gateway='razorpay',
        transaction_id=rp_payment_id,
        failure_reason=None
    )
    db.session.add(txn)
    db.session.commit()
    
    # Notification
    send_notification(
        order.user.email,
        f"Order Confirmed #{order.id}",
        f"Thank you for your order! We have received your payment of {order.total_amount}. We will ship it soon.",
        sms_to=order.user.phone
    )
    
    return jsonify(success=True, order_id=order.id)


@app.route('/api/payments/failure', methods=['POST'])
@jwt_required()
def payment_failure():
    user_id = int(get_jwt_identity())
    data = request.json or {}
    order_id = data.get('order_id')
    reason = data.get('reason', 'Unknown failure')
    payment_id = data.get('payment_id') # Optional gateway payment ID if available

    if not order_id:
        abort(400, description="Missing order_id")

    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    
    # Update order status
    # If currently pending/pending_payment, mark as failed. 
    # Don't override if already paid/cancelled unless it's a retry.
    if order.payment_status != 'paid' and order.status != 'payment_failed' and order.status != 'cancelled':
        order.status = 'payment_failed'
        order.payment_status = 'failed'
        
        # Rollback Stock (Replenish)
        # We reserved stock at creation. Since payment failed, we must release it.
        for item in order.items:
            increase_stock(item.product_id, item.quantity)
        
        # Log transaction
        txn = PaymentTransaction(
            order_id=order.id,
            amount=order.total_amount,
            payment_status='failure',
            payment_gateway=order.payment_gateway,
            transaction_id=payment_id,
            failure_reason=reason
        )
        db.session.add(txn)
        db.session.commit()

        # Send Notification
        send_notification(
            order.user.email, 
            f"Payment Failed for Order #{order.id}",
            f"Your payment for order #{order.id} of {order.total_amount} failed. Reason: {reason}. Stock has been released.",
            sms_to=order.user.phone
        )

    return jsonify({"message": "Payment failure recorded", "status": "failed"})


@app.route('/api/payments/stripe/webhook', methods=['POST'])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        return str(e), 400

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        order = Order.query.filter_by(payment_reference=session['id']).first()
        if order:
            order.payment_status = "paid"
            order.status = "paid"
            db.session.commit()

    return jsonify(success=True)


# -------------------
# Admin Routes
# -------------------
@app.route('/api/admin/dashboard', methods=['GET'])
@role_required('admin')
def admin_dashboard():
    # Parse dates
    start_str = request.args.get('start_date')
    end_str = request.args.get('end_date')
    interval = request.args.get('interval', 'day') # day, week, month

    # Base query for Orders (filtered by date)
    order_query = Order.query
    if start_str:
        try:
            start_date = datetime.fromisoformat(start_str)
            order_query = order_query.filter(Order.created_at >= start_date)
        except: pass
    if end_str:
        try:
            end_date = datetime.fromisoformat(end_str) + timedelta(days=1)
            order_query = order_query.filter(Order.created_at < end_date)
        except: pass

    # Summary Stats (Filtered by date)
    total_orders = order_query.count()
    total_sales = db.session.query(db.func.sum(Order.total_amount)).select_from(Order).filter(
        Order.id.in_([o.id for o in order_query.with_entities(Order.id).all()])
    ).scalar() or 0

    # Global Stats (All Time)
    total_users = User.query.filter_by(role='user').count()
    total_sellers = User.query.filter_by(role='seller').count()
    pending_withdrawals = WithdrawalRequest.query.filter_by(status='requested').count()

    # Graph Data Aggregation
    if interval == 'month':
        fmt = '%Y-%m'
    elif interval == 'week':
        fmt = '%Y-%W'
    else:
        fmt = '%Y-%m-%d'

    # Re-apply filters to graph query
    graph_query = db.session.query(
        db.func.strftime(fmt, Order.created_at).label('period'),
        db.func.count(Order.id),
        db.func.sum(Order.total_amount)
    )
    
    if start_str:
        try:
            graph_query = graph_query.filter(Order.created_at >= datetime.fromisoformat(start_str))
        except: pass
    if end_str:
        try:
            graph_query = graph_query.filter(Order.created_at < datetime.fromisoformat(end_str) + timedelta(days=1))
        except: pass
        
    graph_results = graph_query.group_by('period').order_by('period').all()
    
    chart_data = []
    for res in graph_results:
        chart_data.append({
            "name": res[0],
            "orders": res[1],
            "sales": res[2] or 0
        })

    return jsonify({
        "total_users": total_users,
        "total_sellers": total_sellers,
        "total_orders": total_orders,
        "total_sales": total_sales,
        "pending_withdrawals": pending_withdrawals,
        "chart_data": chart_data
    })


@app.route('/api/admin/logs', methods=['GET'])
@role_required('admin')
def admin_get_logs():
    try:
        if not os.path.exists(log_path):
            return jsonify({"logs": []})
        with open(log_path, 'r') as f:
            lines = f.readlines()
            # Return last 100 lines
            return jsonify({"logs": lines[-100:]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/users', methods=['GET'])
@role_required('admin')
def admin_users():
    users = User.query.all()
    return jsonify([u.to_dict() for u in users])

@app.route('/api/admin/sellers', methods=['GET'])
@role_required('admin')
def admin_sellers():
    sellers = User.query.filter_by(role='seller').all()
    return jsonify([s.to_dict() for s in sellers])

@app.route('/api/admin/sellers/<int:seller_id>/approve', methods=['PUT'])
@role_required('admin')
def admin_approve_seller(seller_id):
    # Promote a user to seller and mark approved. Accepts users that requested seller or existing sellers.
    user = User.query.filter_by(id=seller_id).first_or_404()
    user.role = 'seller'
    user.is_approved = True
    db.session.commit()
    # If there was a SellerRequest, mark it approved
    sr = SellerRequest.query.filter_by(user_id=user.id, status='requested').first()
    if sr:
        sr.status = 'approved'
        db.session.commit()
    return jsonify(message="Seller approved")

@app.route('/api/admin/sellers/<int:seller_id>/status', methods=['PUT'])
@role_required('admin')
def admin_update_seller_status(seller_id):
    user = User.query.get_or_404(seller_id)
    data = request.json or {}
    
    if 'is_approved' in data:
        user.is_approved = bool(data['is_approved'])
        if not user.is_approved:
             sr = SellerRequest.query.filter_by(user_id=user.id, status='requested').first()
             if sr:
                 sr.status = 'rejected'
    
    if 'is_active' in data:
        user.is_active = bool(data['is_active'])

    db.session.commit()
    return jsonify(user.to_dict())

@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@role_required('admin')
def admin_update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.json or {}
    
    if 'name' in data: user.name = data['name']
    if 'email' in data: user.email = data['email']
    if 'role' in data: user.role = data['role']
    if 'is_active' in data: user.is_active = bool(data['is_active'])
    if 'is_approved' in data: user.is_approved = bool(data['is_approved']) # Useful for sellers

    db.session.commit()
    return jsonify(user.to_dict())

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])

@role_required('admin')

def admin_delete_user(user_id):

    user = User.query.get_or_404(user_id)

    db.session.delete(user)

    db.session.commit()

    return jsonify(message="User deleted")




@app.route('/api/admin/notifications/send', methods=['POST'])

@role_required('admin')

def admin_send_notification():

    data = request.json or {}

    target = data.get('target') # 'all_users', 'all_sellers', 'specific'

    user_id = data.get('user_id')

    subject = data.get('subject')

    message = data.get('message')



    if not all([target, subject, message]):

        return jsonify({"error": "Missing required fields"}), 400



    recipients = []



    if target == 'specific':

        if not user_id:

            return jsonify({"error": "User ID required for specific target"}), 400

        user = User.query.get(user_id)

        if user:

            recipients.append(user)

    elif target == 'all_sellers':

        recipients = User.query.filter_by(role='seller').all()

    elif target == 'all_users':

        # Sends to EVERYONE (users, sellers, admins) or just 'user' role?

        # Usually "All Users" implies the customer base.

        # Let's do everyone who is active.

        recipients = User.query.filter_by(is_active=True).all()

    else:

        return jsonify({"error": "Invalid target"}), 400



    count = 0

    for r in recipients:

        # Run in loop - in production this should be a background task/queue

        send_notification(r.email, subject, message, user_id=r.id)

        count += 1



    return jsonify({"message": f"Notification sent to {count} recipients"})




@app.route('/api/admin/seller-requests/<int:req_id>/reject', methods=['PUT'])
@role_required('admin')
def admin_reject_seller_request(req_id):
    req = SellerRequest.query.get_or_404(req_id)
    if req.status != 'requested':
         abort(400, description="Request is not pending")
    req.status = 'rejected'
    db.session.commit()
    return jsonify(message="Seller request rejected", id=req.id, status=req.status)

@app.route('/api/admin/products-for-approval', methods=['GET'])
@role_required('admin')
def admin_pending_products():
    products = Product.query.filter_by(status='pending').all()
    # Add seller_name to response for frontend
    response = []
    for p in products:
        prod_dict = p.to_dict()
        prod_dict['seller_name'] = p.seller.name
        response.append(prod_dict)
    return jsonify(response)


@app.route('/api/admin/products/<int:product_id>/status', methods=['PUT'])
@role_required('admin')
def admin_approve_product(product_id):
    product = Product.query.get_or_404(product_id)
    data = request.json or {}
    product.status = data.get('status') # 'approved' or 'rejected'
    db.session.commit()
    return jsonify(product.to_dict())


@app.route('/api/admin/withdrawals', methods=['GET'])
@role_required('admin')
def admin_withdrawals():
    reqs = WithdrawalRequest.query.all()
    result = []
    for r in reqs:
        result.append({
            "id": r.id,
            "seller_id": r.seller_id,
            "amount": r.amount,
            "seller_name": r.seller.name,
            "status": r.status,
            "requested_at": r.requested_at.isoformat(),
            "payments": [
                {
                    "id": p.id,
                    "amount": p.amount,
                    "method": p.method,
                    "details": p.details,
                    "paid_at": p.paid_at.isoformat() if p.paid_at else None,
                    "admin_id": p.admin_id
                }
                for p in r.payments
            ]
        })
    return jsonify(result)


@app.route('/api/admin/seller-requests', methods=['GET'])
@role_required('admin')
def admin_list_seller_requests():
    reqs = SellerRequest.query.order_by(SellerRequest.requested_at.desc()).all()
    return jsonify([
        {
            "id": r.id,
            "user_id": r.user_id,
            "user_name": r.user.name if r.user else None,
            "status": r.status,
            "requested_at": r.requested_at.isoformat(),
            "note": r.note,
        }
        for r in reqs
    ])


@app.route('/api/admin/withdrawals/<int:req_id>/complete', methods=['PUT'])
@role_required('admin')
def admin_mark_withdrawal_paid(req_id):
    wr = WithdrawalRequest.query.get_or_404(req_id)
    # For demo: simulate sending payment. In a real system integrate with bank/PG here.
    try:
        # Create payment record
        admin_id = get_jwt_identity()
        pr = PaymentRecord(withdrawal_id=wr.id, amount=wr.amount, method='manual', details='Paid by admin via manual transfer', admin_id=admin_id)
        db.session.add(pr)
        wr.status = 'completed'
        db.session.commit()
        return jsonify(id=wr.id, status=wr.status, payment_id=pr.id)
    except Exception as e:
        db.session.rollback()
        abort(500, description=str(e))


@app.route('/api/admin/withdrawals/<int:req_id>/approve', methods=['PUT'])
@role_required('admin')
def admin_approve_withdrawal(req_id):
    wr = WithdrawalRequest.query.get_or_404(req_id)
    if wr.status != 'requested':
        abort(400, description="Can only approve pending requests")
    
    seller = wr.seller
    if not all([seller.bank_account_number, seller.bank_ifsc, seller.bank_beneficiary_name]) and not seller.upi_id:
        return jsonify({"error": "Seller has not provided complete bank details or UPI ID"}), 400

    try:
        if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
             raise Exception("Razorpay keys not configured")

        # Determine payout mode
        # Logic: If withdrawal request has specific method, use that (not implemented fully yet, currently uses seller pref).
        # If seller prefers UPI and has UPI, use UPI. Else Bank.
        mode = "bank"
        if seller.preferred_payout_method == 'upi' and seller.upi_id:
            mode = "upi"
        elif not all([seller.bank_account_number, seller.bank_ifsc]):
             mode = "upi" # Fallback if bank missing
        
        # Helper for Basic Auth
        auth = (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)
        base_url = "https://api.razorpay.com/v1"

        # 1. Create Contact if needed
        if not seller.razorpay_contact_id:
            contact_payload = {
                "name": seller.bank_beneficiary_name or seller.name,
                "email": seller.email,
                "contact": seller.phone or "9999999999",
                "type": "vendor",
                "reference_id": f"seller_{seller.id}"
            }
            r_contact = requests.post(f"{base_url}/contacts", json=contact_payload, auth=auth)
            if not r_contact.ok:
                raise Exception(f"Contact creation failed: {r_contact.text}")
            seller.razorpay_contact_id = r_contact.json()['id']

        # 2. Create Fund Account if needed (or if mode changed/ID missing)
        # We simplified logic: we try to reuse ID, but if we switch modes or details changed, we might need new logic.
        # For simplicity: If we are doing UPI, check if current FA is UPI. Hard to track without storing type.
        # Strategy: Just create a new Fund Account for every payout or check if one exists for this mode?
        # Better: Store `razorpay_fund_account_id` as generic, but if we switch modes, we create new.
        # To be safe/simple for now: Create new Fund Account if not exists OR (we can't easily validate type).
        # Let's just create a new one if we don't have one. If we have one, we assume it matches current details.
        # Actually, if user changes details, we clear the ID in `seller_bank_details`.
        # However, switching from Bank to UPI might cause issue if we reuse ID.
        # FIX: Use separate IDs or just create fresh one if unsure. Creating FA is cheap/idempotent-ish.
        # Let's create FA every time to ensure it matches current `mode`.
        # (Optimization: Store `razorpay_fund_account_id_bank` and `_upi` separately in future).
        
        fa_payload = {}
        if mode == 'upi':
            fa_payload = {
                "contact_id": seller.razorpay_contact_id,
                "account_type": "vpa",
                "vpa": {
                    "address": seller.upi_id
                }
            }
        else:
            fa_payload = {
                "contact_id": seller.razorpay_contact_id,
                "account_type": "bank_account",
                "bank_account": {
                    "name": seller.bank_beneficiary_name,
                    "ifsc": seller.bank_ifsc,
                    "account_number": seller.bank_account_number
                }
            }

        r_fa = requests.post(f"{base_url}/fund_accounts", json=fa_payload, auth=auth)
        if not r_fa.ok:
             raise Exception(f"Fund Account creation failed: {r_fa.text}")
        
        fund_account_id = r_fa.json()['id']
        # Update stored ID only if we want to reuse (maybe skip for now to avoid type mismatch issues)
        seller.razorpay_fund_account_id = fund_account_id 
        db.session.commit() 

        # 3. Create Payout
        account_number = os.getenv("RAZORPAY_X_ACCOUNT_NUMBER")
        if not account_number:
             # Attempt to fetch generic account number or fail
             raise Exception("RAZORPAY_X_ACCOUNT_NUMBER env var is missing")

        payout_payload = {
            "account_number": account_number,
            "fund_account_id": fund_account_id,
            "amount": int(wr.amount * 100), # paise
            "currency": "INR",
            "mode": "UPI" if mode == 'upi' else "IMPS", 
            "purpose": "payout",
            "queue_if_low_balance": True,
            "reference_id": f"withdraw_{wr.id}",
            "narration": f"Payout for Withdrawal #{wr.id}"
        }
        
        r_payout = requests.post(f"{base_url}/payouts", json=payout_payload, auth=auth)
        if not r_payout.ok:
            raise Exception(f"Payout failed: {r_payout.text}")
        
        payout_data = r_payout.json()
        wr.status = 'approved' # In reality, it's 'processing' until webhook confirms.
        wr.payout_id = payout_data.get('id')
        
        # Record Payment
        pr = PaymentRecord(
            withdrawal_id=wr.id,
            amount=wr.amount,
            method=f'razorpay_payout_{mode}',
            details=f"Payout ID: {wr.payout_id}",
            paid_at=datetime.utcnow(),
            admin_id=get_jwt_identity()
        )
        db.session.add(pr)
        db.session.commit()
        
        send_notification(seller.email, "Withdrawal Approved", f"Your withdrawal of Rs. {wr.amount} has been approved and payout initiated via {mode.upper()} (ID: {wr.payout_id}).")
        
        return jsonify({"message": "Withdrawal approved and payout initiated", "payout_id": wr.payout_id})

    except Exception as e:
        app.logger.error(f"Payout Error: {e}")
        return jsonify({"error": f"Payout failed: {str(e)}"}), 500


@app.route('/api/admin/withdrawals/<int:req_id>/reject', methods=['PUT'])
@role_required('admin')
def admin_reject_withdrawal(req_id):
    wr = WithdrawalRequest.query.get_or_404(req_id)
    if wr.status != 'requested':
        abort(400, description="Can only reject pending requests")
    
    data = request.json or {}
    reason = data.get('reason', 'No reason provided')
    
    wr.status = 'rejected'
    wr.rejection_reason = reason
    db.session.commit()
    
    send_notification(wr.seller.email, "Withdrawal Rejected", f"Your withdrawal request for Rs. {wr.amount} was rejected. Reason: {reason}")
    
    return jsonify({"message": "Withdrawal rejected"})

@app.route('/api/admin/withdrawals/process-due', methods=['POST'])
@role_required('admin')
def admin_process_due_withdrawals():
    now = datetime.utcnow()
    # Find approved requests passed due date
    # Note: sqlite might compare string dates differently, ensure consistency. 
    # SQLAlchemy handles python datetime objects reasonably well.
    due_reqs = WithdrawalRequest.query.filter(
        WithdrawalRequest.status == 'approved', 
        WithdrawalRequest.due_date <= now
    ).all()
    
    processed_ids = []
    for wr in due_reqs:
        # Process payment (simulate)
        pr = PaymentRecord(
            withdrawal_id=wr.id, 
            amount=wr.amount, 
            method='auto', 
            details='Automated payout at 11 AM',
            paid_at=now, 
            admin_id=get_jwt_identity()
        )
        db.session.add(pr)
        wr.status = 'completed'
        processed_ids.append(wr.id)
    
    db.session.commit()
    return jsonify(processed=len(processed_ids), ids=processed_ids)


@app.route('/api/coupons', methods=['POST'])
@role_required('admin', 'seller')
def create_coupon():
    user_id = get_jwt_identity()
    role = get_jwt().get('role')
    data = request.json or {}
    
    code = data.get('code')
    discount_percent = data.get('discount_percent')
    
    if not code or not discount_percent:
        return jsonify({"error": "Code and Discount Percent required"}), 400

    # Check duplicate
    if Coupon.query.filter_by(code=code).first():
        return jsonify({"error": "Coupon code already exists"}), 400

    coupon = Coupon(
        code=code,
        discount_percent=float(discount_percent),
        max_discount_amount=data.get('max_discount_amount'),
        min_order_value=data.get('min_order_value', 0),
        usage_limit=data.get('usage_limit', 0),
        type='seller' if role == 'seller' else 'admin',
        seller_id=user_id if role == 'seller' else None
    )
    
    if data.get('expiry_date'):
        try:
            coupon.expiry_date = datetime.fromisoformat(data.get('expiry_date'))
        except: pass

    db.session.add(coupon)
    db.session.commit()
    return jsonify({"message": "Coupon created", "id": coupon.id})

@app.route('/api/cart/apply-coupon', methods=['POST'])
@jwt_required()
def apply_coupon():
    user_id = get_jwt_identity()
    code = (request.json or {}).get('code')
    if not code:
        return jsonify({"error": "Coupon code required"}), 400
        
    cart = Cart.query.filter_by(user_id=user_id).first()
    if not cart:
        return jsonify({"error": "Cart is empty"}), 400

    coupon = Coupon.query.filter_by(code=code, is_active=True).first()
    if not coupon:
        return jsonify({"error": "Invalid coupon code"}), 400
        
    # Basic checks
    if coupon.expiry_date and coupon.expiry_date < datetime.utcnow():
         return jsonify({"error": "Coupon expired"}), 400
    if coupon.usage_limit > 0 and coupon.used_count >= coupon.usage_limit:
         return jsonify({"error": "Coupon usage limit exceeded"}), 400

    # Min order value check needs total, simpler to let get_cart handle strict validation
    # or calculate here. Let's set it and let get_cart re-validate totals.
    
    cart.coupon_code = code
    db.session.commit()
    return jsonify({"message": "Coupon applied"})

@app.route('/api/cart/remove-coupon', methods=['POST'])
@jwt_required()
def remove_coupon():
    user_id = get_jwt_identity()
    cart = Cart.query.filter_by(user_id=user_id).first()
    if cart:
        cart.coupon_code = None
        db.session.commit()
    return jsonify({"message": "Coupon removed"})

# -------------------
# Category Management (Admin & Seller)
# -------------------

@app.route('/api/admin/categories', methods=['GET'])
@role_required('admin')
def admin_list_categories():
    cats = Category.query.all()
    return jsonify([c.to_dict() for c in cats])

@app.route('/api/admin/categories', methods=['POST'])
@role_required('admin')
def admin_create_category():
    data = request.json or {}
    name = data.get('name')
    slug = data.get('slug')
    if not name or not slug:
        return jsonify({"error": "Name and Slug required"}), 400
    
    if Category.query.filter_by(slug=slug).first():
        return jsonify({"error": "Slug already exists"}), 400

    cat = Category(name=name, slug=slug, description=data.get('description', ''), is_approved=True)
    db.session.add(cat)
    db.session.commit()
    return jsonify(cat.to_dict())

@app.route('/api/admin/categories/<int:id>', methods=['PUT'])
@role_required('admin')
def admin_update_category(id):
    cat = Category.query.get_or_404(id)
    data = request.json or {}
    
    if 'name' in data: cat.name = data['name']
    if 'slug' in data: cat.slug = data['slug'] # Need to handle duplicate slug
    if 'description' in data: cat.description = data['description']
    if 'is_approved' in data: cat.is_approved = bool(data['is_approved'])
    
    db.session.commit()
    return jsonify(cat.to_dict())

@app.route('/api/admin/categories/<int:id>', methods=['DELETE'])
@role_required('admin')
def admin_delete_category(id):
    cat = Category.query.get_or_404(id)
    # Handle dependencies (products) - usually prevent delete or cascade
    if Product.query.filter_by(category_id=id).first():
        return jsonify({"error": "Cannot delete category with existing products"}), 400
        
    db.session.delete(cat)
    db.session.commit()
    return jsonify({"message": "Category deleted"})

@app.route('/api/seller/categories', methods=['GET'])
@role_required('seller', 'admin')
def seller_list_categories():
    user_id = get_jwt_identity()
    # Sellers see global categories (approved) AND their own
    cats = Category.query.filter(
        db.or_(
            Category.is_approved == True, 
            Category.seller_id == user_id
        )
    ).all()
    return jsonify([c.to_dict() for c in cats])

@app.route('/api/seller/categories', methods=['POST'])
@role_required('seller', 'admin')
def seller_create_category():
    user_id = get_jwt_identity()
    data = request.json or {}
    name = data.get('name')
    slug = data.get('slug')
    if not name or not slug:
        return jsonify({"error": "Name and Slug required"}), 400
    
    if Category.query.filter_by(slug=slug).first():
        return jsonify({"error": "Slug already exists"}), 400

    cat = Category(
        name=name, 
        slug=slug, 
        description=data.get('description', ''), 
        seller_id=user_id,
        is_approved=False # Needs admin approval
    )
    db.session.add(cat)
    db.session.commit()
    
    # Give seller full permission
    perm = CategoryPermission(category_id=cat.id, user_id=user_id, permission_level='admin')
    db.session.add(perm)
    db.session.commit()

    return jsonify(cat.to_dict())

@app.route('/api/admin/permissions', methods=['GET'])
@role_required('admin')
def admin_list_permissions():
    perms = CategoryPermission.query.all()
    return jsonify([
        {
            "id": p.id,
            "category_name": p.category.name,
            "user_name": p.user.name,
            "role": p.user.role,
            "permission_level": p.permission_level
        }
        for p in perms
    ])





@app.route('/api/user/request-seller', methods=['POST'])
@jwt_required()
def user_request_seller():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    # If user is already a seller or approved, return
    if user.role == 'seller' or user.is_approved:
        return jsonify(message='Already a seller or approved'), 400
    existing = SellerRequest.query.filter_by(user_id=user_id, status='requested').first()
    if existing:
        return jsonify(message='Request already submitted', id=existing.id), 200
    data = request.json or {}
    note = data.get('note')
    sr = SellerRequest(user_id=user_id, status='requested', note=note)
    db.session.add(sr)
    db.session.commit()
    return jsonify(id=sr.id, status=sr.status)

@app.route('/api/seller/categories/request', methods=['POST'])
@role_required('seller', 'admin')
def seller_request_category():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    data = request.json or {}
    name = data.get('name')
    description = data.get('description', '')
    
    if not name:
        return jsonify({"error": "Category name is required"}), 400
        
    # Check uniqueness (case-insensitive)
    existing = Category.query.filter(Category.name.ilike(name)).first()
    if existing:
        return jsonify({"error": "Category with this name already exists"}), 400
        
    # Auto-approve if admin
    is_approved = (user.role == 'admin')
    
    slug = name.lower().replace(' ', '-')
    # Ensure slug uniqueness just in case
    if Category.query.filter_by(slug=slug).first():
        slug = f"{slug}-{uuid4().hex[:4]}"

    cat = Category(
        name=name,
        slug=slug,
        description=description,
        seller_id=user_id,
        is_approved=is_approved
    )
    db.session.add(cat)
    db.session.commit()
    
    # Give seller permission implicitly
    perm = CategoryPermission(category_id=cat.id, user_id=user_id, permission_level='admin')
    db.session.add(perm)
    db.session.commit()
    
    emit_update('category', 'created', cat.to_dict())
    
    return jsonify(cat.to_dict()), 201


# -------------------
# Admin Add Routes (User, Seller, Product)
# -------------------

@app.route('/api/admin/users', methods=['POST'])
@role_required('admin')
def admin_add_user():
    data = request.json or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'user')

    # Validation
    if not all([name, email, password]):
        return jsonify({"error": "Missing required fields: name, email, password"}), 400
    
    if role not in ['user', 'seller', 'admin', 'delivery']:
        return jsonify({"error": "Invalid role"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 400

    try:
        new_user = User(name=name, email=email, role=role)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        return jsonify(new_user.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/sellers', methods=['POST'])
@role_required('admin')
def admin_add_seller():
    data = request.json or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    phone = data.get('phone') # New field
    gst_number = data.get('gst_number') # New field
    address_data = data.get('address') # New field (dict)

    # Validation
    if not all([name, email, password]):
        return jsonify({"error": "Missing required fields: name, email, password"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 400

    try:
        # Explicitly set role to seller and approve them
        new_seller = User(
            name=name, 
            email=email, 
            role='seller', 
            is_approved=True,
            phone=phone,
            gst_number=gst_number
        )
        new_seller.set_password(password)
        db.session.add(new_seller)
        db.session.flush() # Flush to get seller ID for address

        # Add Address if provided
        if address_data and isinstance(address_data, dict):
            if all(k in address_data for k in ['address_line_1', 'city', 'state', 'postal_code']):
                new_addr = Address(
                    user_id=new_seller.id,
                    address_line_1=address_data['address_line_1'],
                    city=address_data['city'],
                    state=address_data['state'],
                    postal_code=address_data['postal_code'],
                    country=address_data.get('country', 'India'),
                    is_default=True
                )
                db.session.add(new_addr)

        db.session.commit()
        return jsonify(new_seller.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/products', methods=['POST'])
@role_required('admin')
def admin_add_product():
    # Handle both JSON and Multipart
    if request.content_type and request.content_type.startswith('multipart/'):
        data = request.form
        files = request.files.getlist('images')
    else:
        data = request.json or {}
        files = []

    seller_id = data.get('seller_id')
    category_id = data.get('category_id')
    name = data.get('name')
    description = data.get('description', '')
    price = data.get('price')
    mrp = data.get('mrp')
    stock_qty = data.get('stock_qty', 0)
    sku = data.get('sku')
    brand = data.get('brand')
    specifications = data.get('specifications')

    # Validation
    if not all([seller_id, category_id, name, price]):
        return jsonify({"error": "Missing required fields: seller_id, category_id, name, price"}), 400

    try:
        price = float(price)
        if price < 0:
             return jsonify({"error": "Price cannot be negative"}), 400
        if mrp:
            mrp = float(mrp)
            if mrp < price:
                return jsonify({"error": "MRP cannot be less than selling price"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid price format"}), 400

    try:
        stock_qty = int(stock_qty)
        if stock_qty < 0:
             return jsonify({"error": "Stock cannot be negative"}), 400
    except (ValueError, TypeError):
         return jsonify({"error": "Invalid stock format"}), 400

    # Check existence
    seller = User.query.get(seller_id)
    if not seller:
        return jsonify({"error": "Seller not found"}), 400
    
    category = Category.query.get(category_id)
    if not category:
        return jsonify({"error": "Category not found"}), 400
    
    # Parse specifications if string (from form-data)
    if isinstance(specifications, str):
        import json
        try:
            specifications = json.loads(specifications)
        except:
            specifications = {}

    try:
        # Transaction: Create Product + Inventory
        product = Product(
            seller_id=seller_id,
            category_id=category_id,
            name=name,
            description=description,
            price=price,
            mrp=mrp or price, # Default MRP to price if not set
            status='approved', # Admin added products are auto-approved
            sku=sku,
            brand=brand,
            specifications=specifications
        )
        db.session.add(product)
        db.session.flush() # Flush to generate product.id

        inventory = Inventory(product_id=product.id, stock_qty=stock_qty)
        db.session.add(inventory)
        
        # Handle Images
        saved_file_records = []
        for idx, f in enumerate(files or []):
            if not f or f.filename == '':
                continue
            filename = secure_filename(f.filename)
            unique_name = f"{uuid4().hex}_{filename}"
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
            f.save(save_path)
            size = os.path.getsize(save_path)
            frec = File(owner_id=get_jwt_identity(), filename=filename, stored_filename=unique_name, filepath=save_path, size=size, status='active')
            db.session.add(frec)
            db.session.flush()
            saved_file_records.append(frec)
            # link
            pi = ProductImage(product_id=product.id, file_id=frec.id, position=idx)
            db.session.add(pi)

        db.session.commit()
        
        # Emit socket event
        emit_update('product', 'created', product.to_dict())
        
        return jsonify(product.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/products', methods=['GET'])
@role_required('admin')
def admin_list_products():
    products = Product.query.all()
    response = []
    for p in products:
        prod_dict = p.to_dict()
        # Ensure status is included (to_dict has it)
        # Add extra admin-only info if needed
        prod_dict['seller_name'] = p.seller.name if p.seller else "Unknown"
        response.append(prod_dict)
    return jsonify(response)

@app.route('/api/admin/orders', methods=['GET'])
@role_required('admin')
def admin_list_orders():
    # Filtering
    sku = request.args.get('sku')
    status = request.args.get('status')
    category_id = request.args.get('category_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    query = Order.query.join(User)

    if status:
        query = query.filter(Order.status == status)
    
    if start_date:
        try:
            sd = datetime.fromisoformat(start_date)
            query = query.filter(Order.created_at >= sd)
        except: pass
    
    if end_date:
        try:
            ed = datetime.fromisoformat(end_date)
            query = query.filter(Order.created_at <= ed)
        except: pass

    # Join for product level filters
    if sku or category_id:
        query = query.join(OrderItem).join(Product)
        if sku:
            query = query.filter(Product.sku.ilike(f"%{sku}%"))
        if category_id:
            query = query.filter(Product.category_id == category_id)
        # Distinct to avoid duplicate orders if multiple items match
        query = query.distinct()

    orders = query.order_by(Order.created_at.desc()).all()
    
    res = []
    for o in orders:
        # Aggregate seller names
        sellers = set()
        for item in o.items:
            if item.seller:
                sellers.add(item.seller.name)
        seller_names = ", ".join(sellers)

        res.append({
            "id": o.id,
            "customer_name": o.user.name, # Renamed to match requirement
            "user_name": o.user.name, # Keep for backward compat if needed
            "seller_names": seller_names,
            "total": o.total_amount,
            "status": o.status,
            "created_at": o.created_at.isoformat()
        })
    return jsonify(res)

@app.route('/api/settings/public', methods=['GET'])
def public_settings():
    return jsonify({
        "site_title": get_setting('site_title', 'Tanjore Heritage Arts'),
        "items_per_page": int(get_setting('items_per_page', 12)),
        "category_grid_columns": int(get_setting('category_grid_columns', 4)),
        "site_logo": get_setting('site_logo'),
        "home_banner_image": get_setting('home_banner_image'),
        "home_banner_video": get_setting('home_banner_video'),
        "home_banner_heading": get_setting('home_banner_heading', 'From the Soil, the Sea, and the Soul'),
        "home_banner_subheading": get_setting('home_banner_subheading', 'Discover a world of authentic products, from farm-fresh goods and durable nets to timeless art.'),
        # Theme Colors
        "theme_brand_primary": get_setting('theme_brand_primary', '#9c7373'),
        "theme_brand_secondary": get_setting('theme_brand_secondary', '#9c7373'),
        "theme_brand_accent": get_setting('theme_brand_accent', '#9c7373'),
        "theme_brand_background": get_setting('theme_brand_background', '#f5e9d1'),
        "theme_layout_background": get_setting('theme_layout_background', '#fefcfb'),
        "theme_layout_card": get_setting('theme_layout_card', '#9c7373'),
        "theme_layout_sidebar": get_setting('theme_layout_sidebar', '#ffffff'),
        "theme_layout_footer": get_setting('theme_layout_footer', '#f5e9d1'),
        "theme_text_primary": get_setting('theme_text_primary', '#000000'),
        "theme_text_secondary": get_setting('theme_text_secondary', '#0d0d0c'),
        "theme_text_muted": get_setting('theme_text_muted', '#0a0a0a'),
        "theme_text_inverse": get_setting('theme_text_inverse', '#272420'),
        "theme_status_success": get_setting('theme_status_success', '#15e53f'),
        "theme_status_warning": get_setting('theme_status_warning', '#ddeb24'),
        "theme_status_error": get_setting('theme_status_error', '#DC2626'),
        "theme_status_info": get_setting('theme_status_info', '#3B82F6'),
    })

@app.route('/api/admin/site-settings', methods=['GET'])
@role_required('admin')
def get_site_settings():
    return jsonify({
        "site_title": get_setting('site_title', ''),
        "items_per_page": get_setting('items_per_page', '12'),
        "category_grid_columns": get_setting('category_grid_columns', '4'),
        "site_logo": get_setting('site_logo', ''),
        "home_banner_image": get_setting('home_banner_image', ''),
        "home_banner_video": get_setting('home_banner_video', ''),
        "home_banner_heading": get_setting('home_banner_heading', ''),
        "home_banner_subheading": get_setting('home_banner_subheading', ''),
        # Theme Colors
        "theme_brand_primary": get_setting('theme_brand_primary', '#9c7373'),
        "theme_brand_secondary": get_setting('theme_brand_secondary', '#9c7373'),
        "theme_brand_accent": get_setting('theme_brand_accent', '#9c7373'),
        "theme_brand_background": get_setting('theme_brand_background', '#f5e9d1'),
        "theme_layout_background": get_setting('theme_layout_background', '#fefcfb'),
        "theme_layout_card": get_setting('theme_layout_card', '#9c7373'),
        "theme_layout_sidebar": get_setting('theme_layout_sidebar', '#ffffff'),
        "theme_layout_footer": get_setting('theme_layout_footer', '#f5e9d1'),
        "theme_text_primary": get_setting('theme_text_primary', '#000000'),
        "theme_text_secondary": get_setting('theme_text_secondary', '#0d0d0c'),
        "theme_text_muted": get_setting('theme_text_muted', '#0a0a0a'),
        "theme_text_inverse": get_setting('theme_text_inverse', '#272420'),
        "theme_status_success": get_setting('theme_status_success', '#15e53f'),
        "theme_status_warning": get_setting('theme_status_warning', '#ddeb24'),
        "theme_status_error": get_setting('theme_status_error', '#DC2626'),
        "theme_status_info": get_setting('theme_status_info', '#3B82F6'),
    })

@app.route('/api/admin/site-settings', methods=['POST'])
@role_required('admin')
def update_site_settings():
    data = request.json or {}
    # Just update keys provided
    keys = [
        "site_title", "items_per_page", "category_grid_columns", "site_logo", 
        "home_banner_image", "home_banner_video", "home_banner_heading", "home_banner_subheading",
        "theme_brand_primary", "theme_brand_secondary", "theme_brand_accent", "theme_brand_background",
        "theme_layout_background", "theme_layout_card", "theme_layout_sidebar", "theme_layout_footer",
        "theme_text_primary", "theme_text_secondary", "theme_text_muted", "theme_text_inverse",
        "theme_status_success", "theme_status_warning", "theme_status_error", "theme_status_info"
    ]
    for key in keys:
        if key in data:
            set_setting(key, data[key])
    return jsonify(message="Site settings updated")



@app.route('/api/user/orders/<int:order_id>/sync_payment', methods=['POST'])
@jwt_required()
def sync_payment_status(order_id):
    """
    Manually check with Payment Gateway if the order was paid.
    Useful if the frontend callback failed or was interrupted.
    """
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    
    if order.payment_status == 'paid':
        return jsonify({"message": "Order already paid", "status": "paid"})

    if order.payment_gateway == 'razorpay' and order.payment_reference:
        if not razorpay_client:
             abort(500, description="Razorpay not configured")
        try:
            # Fetch order details from Razorpay
            rp_order = razorpay_client.order.fetch(order.payment_reference)
            # Check status. 'paid' in Razorpay means authorized/captured.
            # Razorpay order status: created, attempted, paid
            if rp_order.get('status') == 'paid':
                order.payment_status = 'paid'
                order.status = 'paid'
                db.session.commit()
                return jsonify({"message": "Payment synced successfully", "status": "paid"})
            else:
                # Check payments associated with this order
                # Sometimes order status might lag, or if partial payment (not supported here)
                payments = razorpay_client.order.payments(order.payment_reference)
                for p in payments.get('items', []):
                    if p.get('status') == 'captured':
                        order.payment_status = 'paid'
                        order.status = 'paid'
                        db.session.commit()
                        return jsonify({"message": "Payment synced successfully", "status": "paid"})
                        
        except Exception as e:
            app.logger.error(f"Sync payment failed: {e}")
            # Don't abort, just return status as is
            pass

    return jsonify({"message": "Payment not confirmed", "status": order.payment_status})


@app.route('/sitemap.xml', methods=['GET'])
def sitemap():
    base_url = request.url_root.rstrip('/')
    
    # Static pages
    pages = ['/', '/products', '/login', '/register', '/cart']
    
    # Dynamic pages (Products)
    products = Product.query.filter_by(status='approved').all()
    for p in products:
        pages.append(f'/product/{p.id}')
        
    # Dynamic pages (Categories)
    categories = Category.query.all()
    for c in categories:
        pages.append(f'/category/{c.slug}')

    sitemap_xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    sitemap_xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    
    for page in pages:
        sitemap_xml += f'  <url>\n    <loc>{base_url}{page}</loc>\n    <changefreq>daily</changefreq>\n  </url>\n'
        
    sitemap_xml += '</urlset>'
    
    return app.response_class(sitemap_xml, mimetype='application/xml')

@app.route('/robots.txt', methods=['GET'])
def robots_txt():
    base_url = request.url_root.rstrip('/')
    lines = [
        "User-agent: *",
        "Disallow: /admin/",
        "Disallow: /seller/",
        "Disallow: /api/",
        f"Sitemap: {base_url}/sitemap.xml"
    ]
    return app.response_class("\n".join(lines), mimetype='text/plain')

@app.route('/api/files/<int:file_id>/download', methods=['GET'])
def download_file(file_id):
    file_record = File.query.get_or_404(file_id)
    path = file_record.filepath
    if not os.path.exists(path):
        # Fallback: try looking in current upload folder by stored filename
        fallback_path = os.path.join(app.config['UPLOAD_FOLDER'], file_record.stored_filename)
        if os.path.exists(fallback_path):
            path = fallback_path
        else:
            app.logger.error(f"File not found: id={file_id}, path={path}, fallback={fallback_path}")
            abort(404, description="File not found on server")
            
    return send_file(path, as_attachment=False)

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == 'init-db':
        with app.app_context():
            init_db() # Note: init_db needs to be defined or ensure_db_schema used
        print('init-db complete')
        sys.exit(0)
    # Use socketio.run instead of app.run
    socketio.run(app, debug=True, port=5000)