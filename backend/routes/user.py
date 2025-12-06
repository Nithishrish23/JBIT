from flask import Blueprint, request, jsonify, abort, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import User, Address, Cart, CartItem, WishlistItem, Product, Coupon, Order
from utils import get_or_create_cart, get_or_create_wishlist
from datetime import datetime, timedelta
import os

user_bp = Blueprint('user', __name__)

@user_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())

@user_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    data = request.json or {}
    if 'name' in data: user.name = data['name']
    if 'phone' in data: user.phone = data['phone']
    if 'profile_photo_id' in data: user.profile_photo_id = data['profile_photo_id']
    
    db.session.commit()
    return jsonify({"message": "Profile updated", "user": user.to_dict()})

@user_bp.route('/password', methods=['PUT'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    data = request.json or {}
    current_pw = data.get('current_password')
    new_pw = data.get('new_password')
    
    if not user.check_password(current_pw):
        return jsonify({"description": "Incorrect current password"}), 401
    
    if len(new_pw) < 6:
        return jsonify({"description": "Password too short"}), 400
        
    user.set_password(new_pw)
    db.session.commit()
    return jsonify({"message": "Password updated successfully"})

@user_bp.route('/cart', methods=['GET'])
@jwt_required()
def get_cart_route():
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
        is_valid = True
        if not coupon: is_valid = False
        elif coupon.expiry_date and coupon.expiry_date < datetime.utcnow(): is_valid = False
        elif coupon.usage_limit > 0 and coupon.used_count >= coupon.usage_limit: is_valid = False
        elif coupon.min_order_value > 0 and total < coupon.min_order_value: is_valid = False
        
        if is_valid:
            if coupon.type == 'admin':
                discount = (total * coupon.discount_percent) / 100
            elif coupon.type == 'seller' and coupon.seller_id:
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

@user_bp.route('/cart/items', methods=['POST'])
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

@user_bp.route('/cart/items/<int:item_id>', methods=['DELETE'])
@jwt_required()
def remove_from_cart(item_id):
    user_id = get_jwt_identity()
    cart = get_or_create_cart(user_id)
    item = CartItem.query.filter_by(id=item_id, cart_id=cart.id).first_or_404()
    db.session.delete(item)
    db.session.commit()
    return jsonify(message="Removed from cart")

@user_bp.route('/cart/items/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_cart_item(item_id):
    user_id = get_jwt_identity()
    cart = get_or_create_cart(user_id)
    item = CartItem.query.filter_by(id=item_id, cart_id=cart.id).first_or_404()
    data = request.json or {}
    if 'quantity' in data:
        item.quantity = int(data['quantity'])
        if item.quantity <= 0:
            db.session.delete(item)
    db.session.commit()
    return jsonify(message="Cart item updated")

@user_bp.route('/cart/apply-coupon', methods=['POST'])
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
        
    if coupon.expiry_date and coupon.expiry_date < datetime.utcnow():
         return jsonify({"error": "Coupon expired"}), 400
    if coupon.usage_limit > 0 and coupon.used_count >= coupon.usage_limit:
         return jsonify({"error": "Coupon usage limit exceeded"}), 400

    cart.coupon_code = code
    db.session.commit()
    return jsonify({"message": "Coupon applied"})

@user_bp.route('/cart/remove-coupon', methods=['POST'])
@jwt_required()
def remove_coupon():
    user_id = get_jwt_identity()
    cart = Cart.query.filter_by(user_id=user_id).first()
    if cart:
        cart.coupon_code = None
        db.session.commit()
    return jsonify({"message": "Coupon removed"})

@user_bp.route('/wishlist', methods=['GET'])
@jwt_required()
def get_wishlist_route():
    user_id = get_jwt_identity()
    wl = get_or_create_wishlist(user_id)
    items = []
    for i in wl.items:
        product_dict = i.product.to_dict()
        items.append({
            "id": i.id, 
            "product": {
                "id": i.product.id, 
                "name": i.product.name, 
                "price": i.product.price,
                "images": product_dict.get('images', [])
            }
        })
    return jsonify(items)

@user_bp.route('/wishlist', methods=['POST'])
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

@user_bp.route('/wishlist/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete_wishlist_item(product_id):
    user_id = get_jwt_identity()
    wl = get_or_create_wishlist(user_id)
    item = WishlistItem.query.filter_by(product_id=product_id, wishlist_id=wl.id).first_or_404()
    db.session.delete(item)
    db.session.commit()
    return jsonify(message="Removed from wishlist")

@user_bp.route('/addresses', methods=['GET'])
@jwt_required()
def get_user_addresses():
    user_id = get_jwt_identity()
    addresses = Address.query.filter_by(user_id=user_id).all()
    return jsonify([a.to_dict() for a in addresses])

@user_bp.route('/addresses', methods=['POST'])
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

@user_bp.route('/addresses/<int:address_id>', methods=['DELETE'])
@jwt_required()
def delete_user_address(address_id):
    user_id = get_jwt_identity()
    try: uid = int(user_id)
    except: uid = user_id
        
    address = Address.query.filter_by(id=address_id, user_id=uid).first_or_404()
    db.session.delete(address)
    db.session.commit()
    return jsonify(message="Address deleted")

@user_bp.route('/addresses/<int:address_id>/set-default', methods=['PUT'])
@jwt_required()
def set_default_address(address_id):
    user_id = get_jwt_identity()
    try: uid = int(user_id)
    except: uid = user_id

    Address.query.filter_by(user_id=uid, is_default=True).update({Address.is_default: False})
    address = Address.query.filter_by(id=address_id, user_id=uid).first_or_404()
    address.is_default = True
    db.session.commit()
    return jsonify(address.to_dict())

@user_bp.route('/orders', methods=['GET'])
@jwt_required()
def list_user_orders():
    user_id = int(get_jwt_identity())
    limit = request.args.get('limit', type=int)
    query = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc())
    if limit: query = query.limit(limit)
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
            "total": o.total_amount,
            "items": items
        })
    return jsonify(result)

@user_bp.route('/orders/<int:order_id>', methods=['GET'])
@jwt_required()
def get_user_order(order_id):
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    
    tracking_info = {
        "provider": "Internal",
        "tracking_id": f"TRK{order.id}XYZ",
        "status": "Processing" if order.status == 'paid' else order.status,
        "estimated_delivery": (order.created_at + timedelta(days=5)).strftime('%Y-%m-%d'),
        "history": [{"status": "Order Placed", "timestamp": order.created_at.isoformat()}]
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

@user_bp.route('/orders/<int:order_id>/retry', methods=['POST'])
@jwt_required()
def retry_order(order_id):
    # Import from payment_gateway locally to avoid circular imports if any
    from payment_gateway import get_razorpay_client
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    
    if order.payment_status == 'paid':
        return jsonify({"message": "Order already paid", "order_id": order.id})

    data = request.json or {}
    gateway = data.get('payment_method', order.payment_gateway)
    
    order.payment_gateway = gateway
    db.session.commit()

    response_data = {"order_id": order.id, "pg": gateway}
    total = order.total_amount

    try:
        if gateway == "cod":
            order.status = "pending"
            order.payment_status = "cod"
            db.session.commit()
            response_data["message"] = "Order placed successfully with COD"

        elif gateway == "razorpay":
            client = get_razorpay_client()
            if not client: abort(500, description="Razorpay not configured")
            
            rp_order = client.order.create({
                "amount": int(total * 100),
                "currency": "INR",
                "receipt": str(order.id),
                "payment_capture": 1,
            })
            order.payment_reference = rp_order["id"]
            db.session.commit()
            
            response_data.update({
                "amount": total,
                "currency": "INR",
                "razorpay_order_id": rp_order["id"],
                "razorpay_key": os.getenv("RAZORPAY_KEY_ID"),
            })
        
        return jsonify(response_data)

    except Exception as e:
        current_app.logger.error(f"Retry failed: {e}")
        abort(400, description=str(e))

@user_bp.route('/orders/<int:order_id>/invoice', methods=['GET'])
@jwt_required()
def get_user_order_invoice(order_id):
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    if not order.invoice_html: abort(404, description='Invoice not found')
    return current_app.response_class(order.invoice_html, mimetype='text/html')

@user_bp.route('/request-seller', methods=['POST'])
@jwt_required()
def user_request_seller():
    from models import SellerRequest
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    if user.role == 'seller' or user.is_approved:
        return jsonify(message='Already a seller'), 400
    if SellerRequest.query.filter_by(user_id=user_id, status='requested').first():
        return jsonify(message='Request already submitted'), 200
    
    sr = SellerRequest(user_id=user_id, status='requested', note=(request.json or {}).get('note'))
    db.session.add(sr)
    db.session.commit()
    return jsonify(id=sr.id, status=sr.status)