from flask import Flask, jsonify, request
from flask_cors import CORS
from extensions import db, jwt, socketio, resolve_tenant
from routes.auth import auth_bp
from routes.user import user_bp
from routes.seller import seller_bp
from routes.admin import admin_bp
from routes.product import product_bp
from routes.order import order_bp
from routes.payment import payment_bp
from routes.ai import ai_bp
from routes.coupon import coupon_bp
from routes.general import general_bp
from routes.upload import upload_bp
from routes.notification import notification_bp
import os
from dotenv import load_dotenv

load_dotenv()

from logging.handlers import RotatingFileHandler
import logging

def create_app():
    app = Flask(__name__, instance_relative_config=True)
    
    # Config
    # Ensure instance folder exists
    os.makedirs(app.instance_path, exist_ok=True)
    
    # Configure Logging
    if not app.debug:
        log_path = os.path.join(app.instance_path, 'app.log')
        file_handler = RotatingFileHandler(log_path, maxBytes=1024 * 1024, backupCount=10)
        file_handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        app.logger.setLevel(logging.INFO)
        app.logger.info('Ecommerce startup')

    db_path = os.path.join(app.instance_path, 'ecommerce.db')
    # Normalize path separators for Windows compatibility in URI
    db_path = db_path.replace('\\', '/')
    
    env_db_url = os.getenv("DB_URL")
    if env_db_url and not env_db_url.startswith("sqlite"):
        # Use env var for non-sqlite (e.g. postgres)
        app.config['SQLALCHEMY_DATABASE_URI'] = env_db_url
    else:
        # Force absolute path for SQLite to avoid CWD issues
        app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"
    
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.getenv("JWT_SECRET_KEY", "dev-secret")
    app.config['UPLOAD_FOLDER'] = os.path.join(app.instance_path, 'uploads')
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Init Extensions
    db.init_app(app)
    jwt.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*")
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True, allow_headers=["Content-Type", "Authorization", "X-Tenant-Domain"])

    @app.before_request
    def handle_options():
        if request.method == 'OPTIONS':
            return '', 200

    # Middleware
    @app.before_request
    def handle_tenant_middleware():
        resolve_tenant(app)

    # Blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(user_bp, url_prefix='/api/user')
    app.register_blueprint(seller_bp, url_prefix='/api/seller')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(product_bp, url_prefix='/api/products')
    app.register_blueprint(order_bp, url_prefix='/api/orders')
    app.register_blueprint(payment_bp, url_prefix='/api/payments')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    app.register_blueprint(coupon_bp, url_prefix='/api/coupons')
    app.register_blueprint(general_bp, url_prefix='/api')
    app.register_blueprint(upload_bp, url_prefix='/api/upload')
    app.register_blueprint(notification_bp, url_prefix='/api/notifications')

    return app

app = create_app()

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)
