import uuid
import os
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db
import random
import string
import json

super_admin_bp = Blueprint('super_admin', __name__)

# -------------------
# Models (Bind: superadmin)
# -------------------

class SuperAdminUser(db.Model):
    __bind_key__ = 'superadmin'
    __tablename__ = 'super_admin_users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, pwd):
        self.password_hash = generate_password_hash(pwd)

    def check_password(self, pwd):
        return check_password_hash(self.password_hash, pwd)

class Client(db.Model):
    __bind_key__ = 'superadmin'
    __tablename__ = 'clients'

    client_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False) # Contact email
    status = db.Column(db.String(20), default='active', nullable=False)  # active, suspended, blocked
    
    # Domain & Branding
    subdomain = db.Column(db.String(100), unique=True, nullable=True) # e.g. 'agro' -> agro.platform.com
    custom_domain = db.Column(db.String(200), unique=True, nullable=True) # e.g. myagroshop.com
    theme_config = db.Column(db.JSON, default={"primary_color": "#3b82f6", "template": "default"})
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    licenses = db.relationship('License', backref='client', cascade="all, delete-orphan")
    revenue_records = db.relationship('Revenue', backref='client', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "client_id": self.client_id,
            "name": self.name,
            "email": self.email,
            "status": self.status,
            "subdomain": self.subdomain,
            "custom_domain": self.custom_domain,
            "theme_config": self.theme_config,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "license_count": len(self.licenses)
        }

class License(db.Model):
    __bind_key__ = 'superadmin'
    __tablename__ = 'licenses'

    license_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = db.Column(db.String(36), db.ForeignKey('clients.client_id'), nullable=False)
    key = db.Column(db.String(100), unique=True, nullable=False)
    machine_hash = db.Column(db.String(255), nullable=True) # Null means not yet bound
    plan_type = db.Column(db.String(50), default='basic', nullable=False)  # basic, pro, enterprise
    valid_until = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='active', nullable=False)  # active, suspended, blocked
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "license_id": self.license_id,
            "client_id": self.client_id,
            "client_name": self.client.name if self.client else "Unknown",
            "key": self.key,
            "machine_hash": self.machine_hash,
            "plan_type": self.plan_type,
            "valid_until": self.valid_until.isoformat(),
            "status": self.status,
            "created_at": self.created_at.isoformat()
        }

class Subscription(db.Model):
    __bind_key__ = 'superadmin'
    __tablename__ = 'subscriptions'

    subscription_id = db.Column(db.Integer, primary_key=True)
    plan_name = db.Column(db.String(50), unique=True, nullable=False)
    price = db.Column(db.Float, nullable=False)
    features = db.Column(db.JSON, default={})
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "subscription_id": self.subscription_id,
            "plan_name": self.plan_name,
            "price": self.price,
            "features": self.features,
            "created_at": self.created_at.isoformat()
        }

class Revenue(db.Model):
    __bind_key__ = 'superadmin'
    __tablename__ = 'revenue'

    revenue_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = db.Column(db.String(36), db.ForeignKey('clients.client_id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    transaction_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "revenue_id": self.revenue_id,
            "client_id": self.client_id,
            "client_name": self.client.name if self.client else "Unknown",
            "amount": self.amount,
            "transaction_date": self.transaction_date.isoformat()
        }

class SystemConfig(db.Model):
    __bind_key__ = 'superadmin'
    __tablename__ = 'system_config'

    config_key = db.Column(db.String(100), primary_key=True)
    config_value = db.Column(db.Text)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "key": self.config_key,
            "value": self.config_value,
            "description": self.description
        }

# -------------------
# Helpers
# -------------------
def generate_license_key():
    """Generates a random license key."""
    chars = string.ascii_uppercase + string.digits
    return '-'.join(''.join(random.choices(chars, k=4)) for _ in range(4))

# -------------------
# Routes
# -------------------

# --- Auth ---
@super_admin_bp.route('/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')
    
    # Allow configuration of default admin credentials via environment variables
    default_email = os.environ.get('SUPER_ADMIN_EMAIL', 'admin@super.com')
    default_password = os.environ.get('SUPER_ADMIN_PASSWORD', 'admin123')

    # Simple bootstrap check
    if SuperAdminUser.query.count() == 0 and email == default_email:
        # Check password against env var directly for the bootstrap attempt
        if password == default_password:
            # Create default admin persistence
            admin = SuperAdminUser(email=email)
            admin.set_password(password)
            db.session.add(admin)
            db.session.commit()
        else:
             return jsonify({"error": "Invalid credentials"}), 401
    
    user = SuperAdminUser.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401
    
    from flask_jwt_extended import create_access_token
    token = create_access_token(identity=f"superadmin_{user.id}", additional_claims={"role": "superadmin"})
    
    return jsonify({"access_token": token, "user": {"email": user.email, "role": "superadmin"}})

# --- Clients ---
@super_admin_bp.route('/clients', methods=['GET'])
def get_clients():
    clients = Client.query.order_by(Client.created_at.desc()).all()
    return jsonify([c.to_dict() for c in clients])

@super_admin_bp.route('/clients', methods=['POST'])
def create_client():
    data = request.json or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    subdomain = data.get('subdomain', '').strip()
    custom_domain = data.get('custom_domain', '').strip()
    admin_password = data.get('admin_password', '').strip()
    
    if not name or not email:
        return jsonify({"error": "Name and email required"}), 400
        
    # Generate subdomain if not provided (from name)
    if not subdomain:
        subdomain = name.lower().replace(' ', '-') + '-' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))

    # Generate ID explicitly to link User
    new_client_id = str(uuid.uuid4())

    from sqlalchemy import text, create_engine
    from sqlalchemy.exc import IntegrityError

    try:
        # 1. Create Client Record in SuperAdmin DB
        client = Client(
            client_id=new_client_id,
            name=name, 
            email=email,
            subdomain=subdomain,
            custom_domain=custom_domain
        )
        db.session.add(client)
        db.session.commit() # Commit client first so it exists for resolution/reference

        # 2. Initialize Tenant Database
        # We create a new SQLite file for this tenant
        db_folder = os.path.join(current_app.instance_path, 'tenants')
        os.makedirs(db_folder, exist_ok=True)
        tenant_db_path = os.path.join(db_folder, f"{new_client_id}.db")
        tenant_db_url = f"sqlite:///{tenant_db_path.replace(os.sep, '/')}"
        
        # Create engine and tables
        tenant_engine = create_engine(tenant_db_url)
        
        # We need to create tables in this new DB. 
        # We use the global db.metadata which contains User, Product, etc.
        # But we exclude SuperAdmin models which are bound to 'superadmin' key (if any logic separates them, 
        # effectively create_all checks binds. If models have __bind_key__='superadmin', they might be skipped if we bind to None?
        # Actually, create_all(bind=engine) tries to create ALL tables in that engine.
        # We strictly want the 'app' models.
        # Ideally we'd separate metadata, but for now, create_all will create 'user', 'product' etc. in the tenant DB.
        # It might also try to create 'clients' table if it's in the same metadata, but that's fine (just unused there).
        db.metadata.create_all(bind=tenant_engine)
        
        # 3. Create Initial Admin User in Tenant DB
        # Use provided password or default
        pwd_to_use = admin_password if admin_password else "TempPassword123!"
        pwd_hash = generate_password_hash(pwd_to_use)
        
        # Insert into 'user' table (Tenant DB)
        with tenant_engine.connect() as conn:
            sql = text("""
                INSERT INTO user (
                    name, email, password_hash, role, client_id, 
                    is_first_login, is_approved, is_active, created_at
                ) VALUES (
                    :name, :email, :pwd, :role, :client_id, 
                    :is_first, :is_approved, :is_active, :created_at
                )
            """)
            
            conn.execute(sql, {
                "name": name + " Admin",
                "email": email,
                "pwd": pwd_hash,
                "role": 'admin',
                "client_id": new_client_id,
                "is_first": True,
                "is_approved": True,
                "is_active": True,
                "created_at": datetime.utcnow()
            })
            conn.commit()
        
        return jsonify(client.to_dict()), 201
        
    except IntegrityError as e:
        # If client creation failed (e.g. duplicate subdomain in superadmin DB)
        db.session.rollback()
        current_app.logger.warning(f"IntegrityError creating client: {e}")
        return jsonify({"error": "Client with this subdomain or email already exists."}), 400
    except Exception as e:
        # If anything else failed
        # We should try to clean up the client record if it was committed
        # But simplifying for now
        current_app.logger.error(f"Failed to create client and tenant DB: {e}")
        return jsonify({"error": str(e)}), 500

@super_admin_bp.route('/clients/<client_id>', methods=['GET'])
def get_client(client_id):
    client = Client.query.get_or_404(client_id)
    return jsonify(client.to_dict())

@super_admin_bp.route('/clients/<client_id>', methods=['PUT'])
def update_client(client_id):
    client = Client.query.get_or_404(client_id)
    data = request.json or {}
    if 'name' in data: client.name = data['name']
    if 'status' in data: client.status = data['status']
    if 'email' in data: client.email = data['email']
    if 'subdomain' in data: client.subdomain = data['subdomain']
    if 'custom_domain' in data: client.custom_domain = data['custom_domain']
    db.session.commit()
    return jsonify(client.to_dict())

@super_admin_bp.route('/clients/<client_id>', methods=['DELETE'])
def delete_client(client_id):
    client = Client.query.get_or_404(client_id)
    db.session.delete(client)
    db.session.commit()
    return jsonify({"message": "Client deleted"})

# --- Licenses ---
@super_admin_bp.route('/licenses', methods=['GET'])
def get_licenses():
    licenses = License.query.order_by(License.created_at.desc()).all()
    return jsonify([l.to_dict() for l in licenses])

@super_admin_bp.route('/licenses', methods=['POST'])
def create_license():
    data = request.json or {}
    client_id = data.get('client_id')
    plan_type = data.get('plan_type', 'basic')
    days_valid = int(data.get('days_valid', 365))
    
    if not client_id:
        return jsonify({"error": "Client ID required"}), 400
        
    valid_until = datetime.utcnow() + timedelta(days=days_valid)
    key = generate_license_key()
    
    lic = License(
        client_id=client_id,
        key=key,
        plan_type=plan_type,
        valid_until=valid_until
    )
    db.session.add(lic)
    db.session.commit()
    return jsonify(lic.to_dict()), 201

@super_admin_bp.route('/licenses/validate', methods=['POST'])
def validate_license():
    """
    Endpoint for client applications (and Admin UI manual activation) to validate 
    and bind their license key and machine hash.
    """
    data = request.json or {}
    key = data.get('key')
    machine_hash = data.get('machine_hash')
    
    if not key or not machine_hash:
        return jsonify({"valid": False, "error": "Missing key or machine_hash"}), 400
        
    license_obj = License.query.filter_by(key=key).first()
    
    if not license_obj:
        return jsonify({"valid": False, "error": "Invalid license key"}), 404
        
    if license_obj.status != 'active':
        return jsonify({"valid": False, "error": "License is inactive/suspended"}), 403
        
    if license_obj.valid_until < datetime.utcnow():
        return jsonify({"valid": False, "error": "License expired"}), 403
        
    # Check Machine Hash binding
    if license_obj.machine_hash:
        # Already bound, must match
        if license_obj.machine_hash != machine_hash:
            return jsonify({"valid": False, "error": f"Machine hash mismatch (Bound to {license_obj.machine_hash})"}), 403
    else:
        # Not bound yet, bind it now
        license_obj.machine_hash = machine_hash
        db.session.commit()
        
    return jsonify({
        "valid": True, 
        "plan_type": license_obj.plan_type,
        "valid_until": license_obj.valid_until.isoformat(),
        "machine_hash": license_obj.machine_hash
    })

# --- Revenue ---
@super_admin_bp.route('/revenue', methods=['GET'])
def get_revenue():
    # Global analytics
    total_revenue = db.session.query(db.func.sum(Revenue.amount)).scalar() or 0
    
    # Monthly revenue
    start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
    monthly_revenue = db.session.query(db.func.sum(Revenue.amount)).filter(Revenue.transaction_date >= start_of_month).scalar() or 0
    
    # Today's sales
    start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0)
    todays_sales = db.session.query(db.func.sum(Revenue.amount)).filter(Revenue.transaction_date >= start_of_day).scalar() or 0
    
    records = Revenue.query.order_by(Revenue.transaction_date.desc()).limit(100).all()
    
    return jsonify({
        "total_revenue": total_revenue,
        "monthly_revenue": monthly_revenue,
        "todays_sales": todays_sales,
        "recent_transactions": [r.to_dict() for r in records]
    })

# --- Config ---
@super_admin_bp.route('/config', methods=['GET'])
def get_config():
    configs = SystemConfig.query.all()
    return jsonify([c.to_dict() for c in configs])

@super_admin_bp.route('/config', methods=['PUT'])
def update_config():
    data = request.json or {}
    key = data.get('key')
    value = data.get('value')
    
    if not key:
        return jsonify({"error": "Key required"}), 400
        
    conf = SystemConfig.query.get(key)
    if conf:
        conf.config_value = value
    else:
        conf = SystemConfig(config_key=key, config_value=value)
        db.session.add(conf)
    
    db.session.commit()
    return jsonify(conf.to_dict())

# --- Dashboard Overview ---
@super_admin_bp.route('/dashboard/stats', methods=['GET'])
def dashboard_stats():
    total_clients = Client.query.count()
    active_clients = Client.query.filter_by(status='active').count()
    total_licenses = License.query.count()
    total_revenue = db.session.query(db.func.sum(Revenue.amount)).scalar() or 0
    
    return jsonify({
        "total_clients": total_clients,
        "active_clients": active_clients,
        "total_licenses": total_licenses,
        "total_revenue": total_revenue
    })
