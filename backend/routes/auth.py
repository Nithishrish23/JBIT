from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from extensions import db
from models import User, Address
from datetime import timedelta
from flask import current_app

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    phone = data.get('phone')
    role = data.get('role', 'user')

    if not all([name, email, password]):
        return jsonify({"msg": "Missing required fields"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "User already exists"}), 400

    user = User(name=name, email=email, role=role, phone=phone)
    user.set_password(password)
    
    if role == 'seller':
        user.is_approved = False
    
    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})
    return jsonify(access_token=access_token, user=user.to_dict()), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email', '').strip()
    password = data.get('password')
    
    current_app.logger.info(f"Login attempt for: '{email}'")
    
    user = User.query.filter_by(email=email).first()
    
    if not user or not user.check_password(password):
        current_app.logger.warning(f"Login failed for '{email}'")
        abort(401, description="Invalid credentials")
    
    if user.is_first_login:
        temp_token = create_access_token(identity=str(user.id), additional_claims={"role": "onboarding", "temp": True}, expires_delta=timedelta(minutes=15))
        return jsonify({
            "msg": "Password reset required",
            "require_onboarding": True,
            "temp_token": temp_token,
            "user": user.to_dict()
        })

    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role, "client_id": user.client_id})
    return jsonify(access_token=token, user=user.to_dict())

@auth_bp.route('/complete-onboarding', methods=['POST'])
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
    
    current_details = user.shop_details or {}
    if shop_name: current_details['shop_name'] = shop_name
    user.shop_details = current_details
    
    if address:
        addr = Address.query.filter_by(user_id=user.id).first()
        if not addr:
            addr = Address(user_id=user.id, address_line_1=address, city="Unknown", state="Unknown", postal_code="000000", is_default=True)
            db.session.add(addr)
        else:
            addr.address_line_1 = address
            
    db.session.commit()
    
    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role, "client_id": user.client_id})
    return jsonify(access_token=token, user=user.to_dict())

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user = User.query.get_or_404(get_jwt_identity())
    return jsonify(user.to_dict())

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    return jsonify(message="Logged out successfully")
