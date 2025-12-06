from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from extensions import db
from models import Coupon
from utils import role_required
from datetime import datetime

# We need to register this somewhere.
# Wait, `create_coupon` was in `admin.py` in my previous thought process but I see `routes/admin.py` doesn't have it.
# It was in `app.py` originally. I should put it in `admin.py` or a new `coupon.py`.
# Since both Admin and Seller use it, maybe a shared route or keep in `admin.py` and check roles?
# Let's put `create_coupon` in `admin.py` (renamed/shared conceptually) or `product.py`? No.
# Let's add it to `admin.py` but allow sellers.
# Actually, I previously wrote `AdminCoupons.jsx` calling `/api/coupons` POST.
# And `SellerCoupons.jsx` calling `/api/coupons` POST.
# So I need a general `/api/coupons` route. 
# `routes/admin.py` has `admin_bp` prefix `/api/admin`.
# `routes/seller.py` has `seller_bp` prefix `/api/seller`.
# I should probably create `routes/coupon.py` or add to `routes/general.py`?
# Let's add to `routes/general.py` but restricted. Or just add to `routes/admin.py` and map `/api/coupons` manually in `app.py`?
# Better: Add to `routes/admin.py` but mapped to `/api/coupons`? No, blueprints have prefixes.
# I will add it to `routes/general.py` since it's shared, or create a new blueprint `coupon_bp`.
# Let's use `general_bp` for now, or better, add a new file `routes/coupon.py` and register it.

coupon_bp = Blueprint('coupon', __name__)

@coupon_bp.route('', methods=['POST'])
@jwt_required()
def create_coupon():
    user_id = get_jwt_identity()
    claims = get_jwt()
    role = claims.get('role')
    
    if role not in ['admin', 'seller']:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.json or {}
    code = data.get('code')
    discount_percent = data.get('discount_percent')
    
    if not code or not discount_percent:
        return jsonify({"error": "Code and Discount Percent required"}), 400

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
