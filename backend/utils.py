from functools import wraps
from flask import jsonify, request, abort, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity
from extensions import db, socketio
from models import User, Inventory, Cart, Wishlist, Setting, Notification
from services import send_email, send_push_notification
from datetime import datetime

def role_required(*roles):
    """Decorator to check for user roles."""
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            if request.method == 'OPTIONS':
                return jsonify({}), 200
            try:
                verify_jwt_in_request()
            except Exception as e:
                auth_hdr = request.headers.get('Authorization')
                current_app.logger.warning(f"role_required: verify_jwt_in_request failed: {e}; Authorization={auth_hdr}")
                return jsonify({"msg": "Missing or invalid token", "detail": str(e)}), 401

            claims = get_jwt()
            user_role = claims.get('role')
            if user_role not in roles:
                current_app.logger.warning(f"role_required: insufficient role - have={user_role} need={roles}")
                abort(403, description="Forbidden: Insufficient role")
            return fn(*args, **kwargs)
        return decorator
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

def send_notification(user_email, subject, message, sms_to=None, user_id=None):
    """
    Sends email and push notifications, and saves to DB.
    """
    try:
        current_app.logger.info(f"NOTIFICATION: To={user_email}, Subject={subject}, Msg={message}")
        
        # Save to DB if user_id provided
        if user_id:
            notif = Notification(user_id=user_id, subject=subject, message=message)
            db.session.add(notif)
            db.session.commit()
            
        # Send Email
        send_email(user_email, subject, f"<p>{message}</p>")
        
        # Send Push
        if user_id:
            send_push_notification(user_id, subject, message)
            
    except Exception as e:
        current_app.logger.error(f"Failed to send notification: {e}")

def emit_update(resource, action, data=None, room=None):
    """
    Helper to emit updates to connected clients via SocketIO.
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
