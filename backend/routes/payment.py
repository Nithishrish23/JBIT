from flask import Blueprint, request, jsonify, abort, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Order, PaymentTransaction
from payment_gateway import get_razorpay_client, get_stripe_client
from utils import send_notification, increase_stock
import os

payment_bp = Blueprint('payment', __name__)

@payment_bp.route('/initiate/razorpay', methods=['POST'])
@jwt_required()
def initiate_razorpay():
    data = request.json or {}
    order_id = data.get('order_id')
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    
    client = get_razorpay_client()
    if not client: abort(500, description="Razorpay not configured")
    
    rp_order = client.order.create({
        "amount": int(order.total_amount * 100),
        "currency": "INR",
        "receipt": str(order.id),
        "payment_capture": 1
    })
    order.payment_gateway = 'razorpay'
    order.payment_reference = rp_order["id"]
    db.session.commit()
    
    return jsonify({
        "id": rp_order["id"],
        "amount": rp_order["amount"],
        "currency": rp_order["currency"],
        "key_id": os.getenv("RAZORPAY_KEY_ID")
    })

@payment_bp.route('/razorpay/verify', methods=['POST'])
def verify_razorpay():
    data = request.json or {}
    try:
        client = get_razorpay_client()
        client.utility.verify_payment_signature({
            "razorpay_order_id": data.get("razorpay_order_id"),
            "razorpay_payment_id": data.get("razorpay_payment_id"),
            "razorpay_signature": data.get("razorpay_signature"),
        })
    except Exception:
        return jsonify(success=False), 400

    order = Order.query.filter_by(payment_reference=data.get("razorpay_order_id")).first_or_404()
    if order.payment_status != 'paid':
        order.payment_status = "paid"
        order.status = "paid"
        txn = PaymentTransaction(order_id=order.id, amount=order.total_amount, payment_status='success', payment_gateway='razorpay', transaction_id=data.get("razorpay_payment_id"))
        db.session.add(txn)
        db.session.commit()
        send_notification(order.user.email, "Payment Success", f"Order #{order.id} paid.")
    
    return jsonify(success=True)

@payment_bp.route('/webhooks/razorpay', methods=['POST'])
def webhook_razorpay():
    # Implementation of webhook verification
    return jsonify(status='ok')

@payment_bp.route('/failure', methods=['POST'])
@jwt_required()
def payment_failure():
    user_id = int(get_jwt_identity())
    data = request.json or {}
    order_id = data.get('order_id')
    reason = data.get('reason', 'Unknown failure')
    payment_id = data.get('payment_id')

    if not order_id:
        abort(400, description="Missing order_id")

    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    
    if order.payment_status != 'paid' and order.status != 'payment_failed' and order.status != 'cancelled':
        order.status = 'payment_failed'
        order.payment_status = 'failed'
        
        # Rollback Stock
        for item in order.items:
            increase_stock(item.product_id, item.quantity)
        
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

        send_notification(
            order.user.email, 
            f"Payment Failed for Order #{order.id}",
            f"Your payment for order #{order.id} of {order.total_amount} failed. Reason: {reason}. Stock has been released.",
            sms_to=order.user.phone
        )

    return jsonify({"message": "Payment failure recorded", "status": "failed"})
