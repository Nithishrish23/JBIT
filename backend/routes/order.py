from flask import Blueprint, request, jsonify, abort, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from extensions import db
from models import Order, OrderItem, Product, User, Coupon
from utils import get_or_create_cart, decrease_stock, increase_stock, emit_update
from payment_gateway import get_razorpay_client, get_stripe_client
import os
from datetime import datetime

order_bp = Blueprint('order', __name__)

@order_bp.route('', methods=['POST'])
@jwt_required()
def create_order():
    user_id = int(get_jwt_identity())
    data = request.json or {}
    gateway = data.get('payment_method', 'cod')

    cart = get_or_create_cart(user_id)
    if not cart.items:
        abort(400, description="Cart is empty")

    try:
        order = Order(user_id=user_id, status='pending', payment_status='unpaid', payment_gateway=gateway)
        db.session.add(order)
        db.session.flush()

        total = 0
        cart_items_list = [] # For discount calc
        
        for item in cart.items:
            product = item.product
            if product.status != 'approved':
                raise ValueError(f"Product {product.name} not available")
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
            cart_items_list.append({'price': product.price, 'quantity': item.quantity, 'seller_id': product.seller_id})

        # Apply Coupon
        discount = 0
        if cart.coupon_code:
            coupon = Coupon.query.filter_by(code=cart.coupon_code, is_active=True).first()
            if coupon:
                # Validate again
                is_valid = True
                if coupon.expiry_date and coupon.expiry_date < datetime.utcnow(): is_valid = False
                elif coupon.usage_limit > 0 and coupon.used_count >= coupon.usage_limit: is_valid = False
                elif coupon.min_order_value > 0 and total < coupon.min_order_value: is_valid = False
                
                if is_valid:
                    if coupon.type == 'admin':
                        discount = (total * coupon.discount_percent) / 100
                    elif coupon.type == 'seller' and coupon.seller_id:
                        seller_total = sum(i['price'] * i['quantity'] for i in cart_items_list if i['seller_id'] == coupon.seller_id)
                        discount = (seller_total * coupon.discount_percent) / 100
                    
                    if coupon.max_discount_amount and discount > coupon.max_discount_amount:
                        discount = coupon.max_discount_amount
                        
                    coupon.used_count = (coupon.used_count or 0) + 1
                    db.session.add(coupon)

        final_total = max(0, total - discount)
        order.total_amount = final_total
        
        # Invoice generation simplified
        order.invoice_html = f"<h1>Invoice #{order.id}</h1><p>Subtotal: {total}</p><p>Discount: {discount}</p><p>Total: {final_total}</p>"

        response_data = {"order_id": order.id}

        if gateway in ["cod", "pay_later"]:
            order.status = "pending_payment"
            order.payment_status = "unpaid"
            response_data["message"] = "Order placed successfully."
            response_data["pg"] = gateway

        elif gateway == "razorpay" or gateway == "upi":
            client = get_razorpay_client()
            if not client: raise ValueError("Razorpay not configured")
            # Amount in paise
            amount_paise = int(final_total * 100)
            if amount_paise == 0: amount_paise = 100 # Minimum 1 INR for testing if free?
            
            rp_order = client.order.create({
                "amount": amount_paise,
                "currency": "INR",
                "receipt": str(order.id),
                "payment_capture": 1
            })
            order.payment_reference = rp_order["id"]
            response_data.update({
                "pg": "razorpay",
                "amount": final_total,
                "currency": "INR",
                "razorpay_order_id": rp_order["id"],
                "razorpay_key": os.getenv("RAZORPAY_KEY_ID"),
                "method_preference": "upi" if gateway == "upi" else None
            })

        elif gateway == "stripe":
            stripe = get_stripe_client()
            if not stripe.api_key: raise ValueError("Stripe not configured")
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[{"price_data": {"currency": "usd", "product_data": {"name": f"Order {order.id}"}, "unit_amount": int(final_total * 100)}, "quantity": 1}],
                mode="payment",
                success_url="http://localhost:5173/payment-status?success=true",
                cancel_url="http://localhost:5173/payment-status?success=false",
            )
            order.payment_reference = session.id
            response_data.update({
                "pg": "stripe",
                "checkout_session_id": session.id,
                "checkout_url": session.url,
            })

        for item in list(cart.items):
            db.session.delete(item)
        
        # Clear coupon from cart (optional, but clean)
        cart.coupon_code = None
        
        db.session.commit()
        emit_update('order', 'created', {"id": order.id, "total": final_total})
        return jsonify(response_data)

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Order failed: {e}")
        abort(400, description=str(e))

@order_bp.route('/<int:order_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_order(order_id):
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    if order.status == 'cancelled': abort(400, description="Already cancelled")
    for item in order.items:
        increase_stock(item.product_id, item.quantity)
    order.status = 'cancelled'
    order.payment_status = 'refunded'
    db.session.commit()
    return jsonify(status='cancelled')

@order_bp.route('/<int:order_id>/track', methods=['GET'])
@jwt_required()
def order_track(order_id):
    # Public tracking endpoint logic, adapted
    order = Order.query.get_or_404(order_id)
    return jsonify({"status": order.status, "delivery_info": order.delivery_info})

@order_bp.route('/<int:order_id>/status', methods=['PUT'])
@jwt_required()
def update_order_status(order_id):
    # This was in app.py as /api/orders/<id>/status with seller/admin role
    # Need to verify permissions manually or use decorator if this route is under /api/orders (which it is here)
    # But wait, this BP is mounted at /api/orders? 
    # The previous user route was /api/user/orders.
    # The admin route was /api/admin/orders (listing).
    # The status update was /api/orders/<id>/status.
    # So this file should handle /api/orders prefix?
    # Yes, I'll mount this BP to /api/orders.
    
    # Re-implement role check
    claims = get_jwt()
    role = claims.get('role')
    if role not in ['seller', 'admin']:
        abort(403)
        
    order = Order.query.get_or_404(order_id)
    data = request.json or {}
    if 'status' in data: order.status = data['status']
    if 'delivery_info' in data: order.delivery_info = data['delivery_info']
    db.session.commit()
    return jsonify(status=order.status)
