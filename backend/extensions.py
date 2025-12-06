from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from flask import current_app, request

db = SQLAlchemy()
jwt = JWTManager()
socketio = SocketIO(cors_allowed_origins="*")

# Placeholder for tenant resolution if needed in future, currently simple no-op or basic logging
def resolve_tenant(app):
    pass
