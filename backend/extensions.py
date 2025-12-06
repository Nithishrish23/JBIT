from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from flask import g, current_app, request
from sqlalchemy import create_engine, text
import os

class TenantSQLAlchemy(SQLAlchemy):
    def get_bind(self, mapper=None, clause=None):
        """
        Override get_bind to support dynamic tenant database binding.
        If a specific bind_key is set on the model (e.g., 'superadmin'), respect it.
        Otherwise, check if a tenant-specific DB URL is set in flask.g.
        """
        # 1. If the model/table explicitly defines a bind_key (like SuperAdminUser), use it.
        if mapper is not None:
            info = getattr(mapper.mapped_table, 'info', {})
            bind_key = info.get('bind_key')
            if bind_key is not None:
                return self.engines[bind_key]

        # 2. If we are in a request context and a tenant DB is identified
        if has_app_context() and hasattr(g, 'tenant_db_url') and g.tenant_db_url:
            # Create/Cache engine for this tenant
            # We use the application's extension dict to cache engines to avoid recreation overhead
            state = self.get_app_state(self.get_app())
            
            # We store tenant engines in a separate dictionary
            if not hasattr(state, 'tenant_engines'):
                state.tenant_engines = {}
            
            if g.tenant_db_url not in state.tenant_engines:
                # Create new engine for this tenant
                new_engine = create_engine(g.tenant_db_url)
                state.tenant_engines[g.tenant_db_url] = new_engine
                
            return state.tenant_engines[g.tenant_db_url]

        # 3. Fallback to default 'ecommerce.db' (Platform/Fallback)
        return super().get_bind(mapper, clause)

    def get_app(self):
        # Helper to get current app, needed because get_app isn't always available in older/newer versions directly on self
        if current_app:
            return current_app
        return self.app

def has_app_context():
    try:
        return current_app._get_current_object() is not None
    except RuntimeError:
        return False

db = TenantSQLAlchemy()
jwt = JWTManager()
socketio = SocketIO(cors_allowed_origins="*")

def resolve_tenant(app):
    """
    Middleware to resolve tenant from request header (X-Tenant-Domain).
    Sets g.tenant_db_url if a matching tenant is found.
    """
    tenant_domain = request.headers.get('X-Tenant-Domain')
    
    # Skip for static files or superadmin routes
    if request.path.startswith('/api/superadmin') or request.path.startswith('/api/static'):
        return

    if not tenant_domain:
        # Fallback to default DB (no tenant isolation for direct IP access or localhost without context)
        return

    # Extract subdomain if possible or use full domain
    # Logic: check 'clients' table in superadmin DB to find matching subdomain/custom_domain
    try:
        # We need to access the superadmin DB explicitly to find the tenant
        # This query happens on every request, so caching (Redis) would be ideal in production
        
        # We use the 'superadmin' bind
        sa_engine = db.engines.get('superadmin')
        if not sa_engine:
            return

        with sa_engine.connect() as conn:
            # Simplified matching logic: 
            # 1. Check custom_domain exact match
            # 2. Check subdomain match (assuming tenant_domain is like 'sub.platform.com')
            
            # Parse subdomain from header (e.g. "shop1.localhost:5173" -> "shop1")
            # This is brittle and depends on BASE_PLATFORM_DOMAIN logic. 
            # For robust matching, we might store full domains or query flexibly.
            
            # Let's try exact match first or LIKE
            # Note: This SQL assumes we added these columns.
            
            # Clean port number for matching if stored without port
            domain_no_port = tenant_domain.split(':')[0]
            
            # Check custom domain
            result = conn.execute(text("SELECT client_id, subdomain FROM clients WHERE custom_domain = :d OR custom_domain = :d_port"), {"d": domain_no_port, "d_port": tenant_domain}).fetchone()
            
            if not result:
                # Check subdomain
                # If request is 'shop1.localhost', subdomain is 'shop1'
                parts = domain_no_port.split('.')
                if len(parts) > 1:
                    sub = parts[0]
                    result = conn.execute(text("SELECT client_id, subdomain FROM clients WHERE subdomain = :s"), {"s": sub}).fetchone()
            
            if result:
                client_id = result[0]
                # Construct Tenant DB URL
                # We use a separate SQLite file per tenant: instance/tenants/<client_id>.db
                db_folder = os.path.join(app.instance_path, 'tenants')
                os.makedirs(db_folder, exist_ok=True)
                tenant_db_path = os.path.join(db_folder, f"{client_id}.db")
                g.tenant_db_url = f"sqlite:///{tenant_db_path.replace(os.sep, '/')}"
                g.tenant_id = client_id
                
                # Ensure Tenant DB has schema? 
                # Doing this on every request is heavy. 
                # Ideally, we do this on tenant creation or first access check.
                # For prototype, we can check if file exists.
                if not os.path.exists(tenant_db_path):
                    # Initialize schema for this new tenant DB
                    # We need to bind the engine temporarily and call create_all
                    # This is tricky inside a request.
                    # Better approach: Create DB on 'create_client'.
                    pass 

    except Exception as e:
        app.logger.error(f"Tenant resolution failed: {e}")