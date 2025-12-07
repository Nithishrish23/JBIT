from flask import Blueprint, request, jsonify, abort, current_app
from flask_jwt_extended import get_jwt_identity, get_jwt
from extensions import db
from models import User, Product, OrderItem, WithdrawalRequest, Order, Inventory, File, ProductImage, PaymentRecord, SellerPurchaseBill, SellerSalesBill, Category, CategoryPermission, SellerRequest, Coupon, CartItem, WishlistItem, Review, Advertisement
from utils import role_required, emit_update
from werkzeug.utils import secure_filename
from uuid import uuid4
import os
from datetime import datetime, timedelta

seller_bp = Blueprint('seller', __name__)

@seller_bp.route('/dashboard/stats', methods=['GET'])
@role_required('seller', 'admin')
def seller_dashboard():
    user_id = get_jwt_identity()
    products = Product.query.filter_by(seller_id=user_id).count()
    orders = OrderItem.query.filter_by(seller_id=user_id).count()
    total_sales = db.session.query(db.func.sum(OrderItem.subtotal)) \
        .filter_by(seller_id=user_id).scalar() or 0
    return jsonify({
        "product_count": products,
        "pending_orders": orders,
        "total_sales": total_sales
    })

@seller_bp.route('/products', methods=['GET'])
@role_required('seller', 'admin')
def seller_products():
    user_id = get_jwt_identity()
    prods = Product.query.filter_by(seller_id=user_id).all()
    return jsonify([p.to_dict() for p in prods])

@seller_bp.route('/products', methods=['POST'])
@role_required('seller', 'admin')
def seller_add_product():
    user_id = get_jwt_identity()
    if request.content_type and request.content_type.startswith('multipart/'):
        form = request.form
        files = request.files.getlist('images')
        name = form.get('name')
        description = form.get('description', '')
        price = form.get('price')
        category_id = form.get('category_id')
        stock_qty = form.get('stock_qty', 0)
        brand = form.get('brand')
        specifications = form.get('specifications')
    else:
        data = request.json or {}
        files = []
        name = data.get('name')
        description = data.get('description', '')
        price = data.get('price')
        category_id = data.get('category_id')
        stock_qty = data.get('stock_qty', 0)
        brand = data.get('brand')
        specifications = data.get('specifications')

    if not all([name, price, category_id]):
        abort(400, description="Missing fields")

    try:
        price = float(price)
    except Exception:
        abort(400, description='Invalid price')
    try:
        category_id = int(category_id)
    except Exception:
        abort(400, description='Invalid category_id')
    try:
        stock_qty = int(stock_qty or 0)
    except Exception:
        stock_qty = 0
        
    if isinstance(specifications, str):
        import json
        try:
            specifications = json.loads(specifications)
        except:
            specifications = {}

    product = Product(
        seller_id=user_id,
        category_id=category_id,
        name=name,
        description=description,
        price=price,
        status='pending',
        brand=brand,
        specifications=specifications
    )

    db.session.add(product)
    db.session.flush()

    inventory = Inventory(product_id=product.id, stock_qty=stock_qty)
    db.session.add(inventory)

    saved_file_records = []
    try:
        upload_folder = current_app.config['UPLOAD_FOLDER']
        for idx, f in enumerate(files or []):
            if not f or f.filename == '':
                continue
            filename = secure_filename(f.filename)
            unique_name = f"{uuid4().hex}_{filename}"
            save_path = os.path.join(upload_folder, unique_name)
            f.save(save_path)
            size = os.path.getsize(save_path)
            frec = File(owner_id=user_id, filename=filename, stored_filename=unique_name, filepath=save_path, size=size, status='active')
            db.session.add(frec)
            db.session.flush()
            saved_file_records.append(frec)
            pi = ProductImage(product_id=product.id, file_id=frec.id, position=idx)
            db.session.add(pi)

        db.session.commit()
        return jsonify(product=product.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        for frec in saved_file_records:
            try:
                if os.path.exists(frec.filepath):
                    os.remove(frec.filepath)
            except Exception:
                pass
        abort(500, description=str(e))

@seller_bp.route('/products/<int:product_id>', methods=['PUT'])
@role_required('seller', 'admin')
def seller_edit_product(product_id):
    user_id = get_jwt_identity()
    claims = get_jwt()
    is_admin = claims.get('role') == 'admin'
    
    query = Product.query.filter_by(id=product_id)
    if not is_admin:
        query = query.filter_by(seller_id=user_id)
        
    product = query.first_or_404()
    
    # Check for multipart
    if request.content_type and request.content_type.startswith('multipart/'):
        data = request.form
        files = request.files.getlist('images')
    else:
        data = request.json or {}
        files = []
    
    if 'name' in data: product.name = data['name']
    if 'description' in data: product.description = data['description']
    if 'price' in data:
        try: product.price = float(data['price'])
        except: pass
    if 'mrp' in data:
        try: product.mrp = float(data['mrp'] or 0)
        except: pass
            
    # Handle stock (accepts 'stock_qty' or 'quantity')
    stock_val = data.get('stock_qty') or data.get('quantity')
    if stock_val is not None:
        try:
            qty = int(stock_val)
            if product.inventory:
                product.inventory.stock_qty = qty
            else:
                 inv = Inventory(product_id=product.id, stock_qty=qty)
                 db.session.add(inv)
        except: pass

    # Handle Files (Append new images)
    if files:
        upload_folder = current_app.config['UPLOAD_FOLDER']
        # Get current max position
        current_max_pos = db.session.query(db.func.max(ProductImage.position)).filter_by(product_id=product.id).scalar()
        if current_max_pos is None: current_max_pos = -1
        
        for idx, f in enumerate(files):
            if not f or f.filename == '': continue
            try:
                filename = secure_filename(f.filename)
                unique_name = f"{uuid4().hex}_{filename}"
                save_path = os.path.join(upload_folder, unique_name)
                f.save(save_path)
                size = os.path.getsize(save_path)
                frec = File(owner_id=user_id, filename=filename, stored_filename=unique_name, filepath=save_path, size=size, status='active')
                db.session.add(frec)
                db.session.flush()
                
                pi = ProductImage(product_id=product.id, file_id=frec.id, position=current_max_pos + 1 + idx)
                db.session.add(pi)
            except Exception as e:
                print(f"Error saving file update: {e}")

    db.session.commit()
    return jsonify(product.to_dict())

@seller_bp.route('/products/<int:product_id>', methods=['DELETE'])
@role_required('seller', 'admin')
def seller_delete_product(product_id):
    user_id = get_jwt_identity()
    product = Product.query.filter_by(id=product_id, seller_id=user_id).first_or_404()
    
    # Check for existing orders
    if OrderItem.query.filter_by(product_id=product.id).first():
        return jsonify({"error": "Cannot delete product with existing orders. Please contact support to archive it."}), 400

    try:
        # Delete dependencies
        if product.inventory:
            db.session.delete(product.inventory)
        
        ProductImage.query.filter_by(product_id=product.id).delete()
        CartItem.query.filter_by(product_id=product.id).delete()
        WishlistItem.query.filter_by(product_id=product.id).delete()
        Review.query.filter_by(product_id=product.id).delete()
        Advertisement.query.filter_by(product_id=product.id).delete()

        db.session.delete(product)
        db.session.commit()
        return jsonify(message="Product deleted")
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting product {product_id}: {e}")
        return jsonify({"error": "Failed to delete product due to internal error"}), 500

@seller_bp.route('/products/<int:product_id>', methods=['GET'])
@role_required('seller', 'admin')
def seller_get_product(product_id):
    user_id = get_jwt_identity()
    product = Product.query.filter_by(id=product_id, seller_id=user_id).first_or_404()
    return jsonify(product.to_dict())

@seller_bp.route('/products/<int:product_id>/stock', methods=['PUT'])
@role_required('seller', 'admin')
def seller_update_stock(product_id):
    user_id = get_jwt_identity()
    product = Product.query.filter_by(id=product_id, seller_id=user_id).first_or_404()
    data = request.json or {}
    new_stock = int(data.get('stock'))
    product.inventory.stock_qty = new_stock
    db.session.commit()
    return jsonify(message="Stock updated")

@seller_bp.route('/inventory', methods=['GET'])
@role_required('seller', 'admin')
def seller_inventory():
    user_id = get_jwt_identity()
    prods = Product.query.filter_by(seller_id=user_id).all()
    return jsonify([p.to_dict() for p in prods])

@seller_bp.route('/orders', methods=['GET'])
@role_required('seller', 'admin')
def seller_orders():
    user_id = get_jwt_identity()
    items = OrderItem.query.filter_by(seller_id=user_id).all()
    result = []
    for i in items:
        result.append({
            "order_id": i.order_id,
            "product_name": i.product.name,
            "quantity": i.quantity,
            "price": i.price,
            "status": i.order.status
        })
    return jsonify(result)

@seller_bp.route('/bank-details', methods=['GET', 'POST'])
@role_required('seller', 'admin')
def seller_bank_details():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)

    if request.method == 'GET':
        return jsonify({
            "bank_account_number": user.bank_account_number,
            "bank_ifsc": user.bank_ifsc,
            "bank_beneficiary_name": user.bank_beneficiary_name,
            "upi_id": user.upi_id,
            "preferred_payout_method": user.preferred_payout_method
        })

    data = request.json or {}
    user.bank_account_number = data.get('bank_account_number')
    user.bank_ifsc = data.get('bank_ifsc')
    user.bank_beneficiary_name = data.get('bank_beneficiary_name')
    user.upi_id = data.get('upi_id')
    user.preferred_payout_method = data.get('preferred_payout_method', 'bank')
    user.razorpay_fund_account_id = None 
    db.session.commit()
    return jsonify({"message": "Payout details saved successfully"})

@seller_bp.route('/withdrawals', methods=['GET'])
@role_required('seller', 'admin')
def seller_withdrawals():
    user_id = get_jwt_identity()
    reqs = WithdrawalRequest.query.filter_by(seller_id=user_id).order_by(WithdrawalRequest.requested_at.desc()).all()
    
    total_sales = db.session.query(db.func.sum(OrderItem.subtotal)).filter_by(seller_id=user_id).scalar() or 0
    
    withdrawn_amount = db.session.query(db.func.sum(WithdrawalRequest.amount)).filter(
        WithdrawalRequest.seller_id == user_id,
        WithdrawalRequest.status != 'rejected',
        WithdrawalRequest.status != 'cancelled'
    ).scalar() or 0
    
    available_balance = total_sales - withdrawn_amount
    
    user = User.query.get(user_id)
    has_bank = all([user.bank_account_number, user.bank_ifsc, user.bank_beneficiary_name])
    has_upi = bool(user.upi_id)
    bank_details_configured = has_bank or has_upi

    response = {
        "balance": available_balance,
        "total_withdrawn": withdrawn_amount,
        "bank_details_configured": bank_details_configured,
        "has_bank": has_bank,
        "has_upi": has_upi,
        "withdrawals": [
            {
                "id": r.id,
                "amount": r.amount,
                "status": r.status,
                "created_at": r.requested_at.isoformat(),
                "rejection_reason": r.rejection_reason
            }
            for r in reqs
        ]
    }
    return jsonify(response)

@seller_bp.route('/withdrawals/request', methods=['POST'])
@role_required('seller', 'admin')
def seller_request_withdrawal():
    user_id = get_jwt_identity()
    data = request.json or {}
    
    total_sales = db.session.query(db.func.sum(OrderItem.subtotal)).filter_by(seller_id=user_id).scalar() or 0
    withdrawn_amount = db.session.query(db.func.sum(WithdrawalRequest.amount)).filter(
        WithdrawalRequest.seller_id == user_id,
        WithdrawalRequest.status != 'rejected',
        WithdrawalRequest.status != 'cancelled'
    ).scalar() or 0
    available_balance = total_sales - withdrawn_amount

    requested_amount = data.get('amount')
    if requested_amount is not None:
        try:
            amount = float(requested_amount)
        except ValueError:
            abort(400, description="Invalid amount format")
    else:
        amount = available_balance

    if amount <= 0:
        abort(400, description="Invalid amount or insufficient balance")
        
    if amount > available_balance + 0.01:
        abort(400, description="Insufficient balance")
    
    payment_method = data.get('payment_method')
    payment_details = data.get('payment_details')

    now = datetime.utcnow()
    target_time = now.replace(hour=11, minute=0, second=0, microsecond=0)
    if now >= target_time:
        target_time += timedelta(days=1)
        
    wr = WithdrawalRequest(
        seller_id=user_id,
        amount=amount,
        status='requested',
        requested_at=now,
        due_date=target_time
    )
    db.session.add(wr)
    db.session.commit()

    if payment_method or payment_details:
        pr = PaymentRecord(
            withdrawal_id=wr.id, 
            amount=amount, 
            method=payment_method, 
            details=str(payment_details), 
            paid_at=None, 
            admin_id=None
        )
        db.session.add(pr)
        db.session.commit()

    return jsonify(id=wr.id, status=wr.status, due_date=target_time.isoformat())

@seller_bp.route('/withdrawals/<int:id>/cancel', methods=['POST'])
@role_required('seller', 'admin')
def seller_cancel_withdrawal(id):
    user_id = get_jwt_identity()
    wr = WithdrawalRequest.query.filter_by(id=id, seller_id=user_id).first_or_404()
    
    if wr.status != 'requested':
        abort(400, description="Cannot cancel withdrawal that is not in requested state")
        
    wr.status = 'cancelled'
    db.session.commit()
    
    total_sales = db.session.query(db.func.sum(OrderItem.subtotal)).filter_by(seller_id=user_id).scalar() or 0
    withdrawn_amount = db.session.query(db.func.sum(WithdrawalRequest.amount)).filter(
        WithdrawalRequest.seller_id == user_id,
        WithdrawalRequest.status != 'rejected',
        WithdrawalRequest.status != 'cancelled'
    ).scalar() or 0
    balance = total_sales - withdrawn_amount
    
    return jsonify(message="Withdrawal cancelled", balance=balance)

@seller_bp.route('/transactions', methods=['GET'])
@role_required('seller', 'admin')
def seller_transactions():
    user_id = get_jwt_identity()
    
    sales = db.session.query(
        OrderItem.id, 
        OrderItem.subtotal, 
        Order.created_at.label('date'),
        Product.name
    ).join(Order).join(Product).filter(OrderItem.seller_id == user_id).all()
    
    withdrawals = WithdrawalRequest.query.filter_by(seller_id=user_id).all()
    
    transactions = []
    
    for s in sales:
        transactions.append({
            "id": f"sale-{s.id}",
            "type": "credit",
            "amount": s.subtotal,
            "date": s.date.isoformat(),
            "description": f"Sale: {s.name}",
            "status": "completed"
        })
        
    for w in withdrawals:
        transactions.append({
            "id": f"withdraw-{w.id}",
            "type": "debit",
            "amount": w.amount,
            "date": w.requested_at.isoformat(),
            "description": f"Withdrawal Request #{w.id}",
            "status": w.status
        })
        
    transactions.sort(key=lambda x: x['date'], reverse=True)
    return jsonify(transactions)

@seller_bp.route('/profile', methods=['GET'])
@role_required('seller', 'admin')
def get_seller_profile():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())

@seller_bp.route('/billing/purchase', methods=['POST'])
@role_required('seller', 'admin')
def seller_add_purchase_bill():
    user_id = get_jwt_identity()
    data = request.json or {}
    bill = SellerPurchaseBill(
        seller_id=user_id,
        supplier_name=data.get('supplier_name'),
        bill_number=data.get('bill_number'),
        total_amount=data.get('total_amount'),
        bill_date=datetime.fromisoformat(data.get('bill_date')) if data.get('bill_date') else datetime.utcnow()
    )
    db.session.add(bill)
    db.session.commit()
    return jsonify(message="Purchase bill added")

@seller_bp.route('/billing/sales', methods=['GET'])
@role_required('seller', 'admin')
def seller_sales_bills():
    user_id = get_jwt_identity()
    bills = SellerSalesBill.query.filter_by(seller_id=user_id).all()
    return jsonify([
        {
            "id": b.id,
            "order_id": b.order_id,
            "bill_number": b.bill_number,
            "total_amount": b.total_amount,
            "bill_date": b.bill_date.isoformat()
        }
        for b in bills
    ])

@seller_bp.route('/categories', methods=['GET'])
@role_required('seller', 'admin')
def seller_list_categories():
    user_id = get_jwt_identity()
    cats = Category.query.filter(
        db.or_(Category.is_approved == True, Category.seller_id == user_id)
    ).all()
    return jsonify([c.to_dict() for c in cats])

@seller_bp.route('/categories', methods=['POST'])
@role_required('seller', 'admin')
def seller_create_category():
    user_id = get_jwt_identity()
    data = request.json or {}
    name = data.get('name')
    slug = data.get('slug')
    if not name or not slug:
        return jsonify({"error": "Name and Slug required"}), 400
    
    if Category.query.filter_by(slug=slug).first():
        return jsonify({"error": "Slug already exists"}), 400

    cat = Category(
        name=name, 
        slug=slug, 
        description=data.get('description', ''), 
        seller_id=user_id,
        is_approved=False
    )
    db.session.add(cat)
    db.session.commit()
    
    perm = CategoryPermission(category_id=cat.id, user_id=user_id, permission_level='admin')
    db.session.add(perm)
    db.session.commit()

    return jsonify(cat.to_dict())

@seller_bp.route('/categories/request', methods=['POST'])
@role_required('seller', 'admin')
def seller_request_category():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if request.content_type and request.content_type.startswith('multipart/'):
        data = request.form
        file = request.files.get('image')
    else:
        data = request.json or {}
        file = None

    name = data.get('name')
    description = data.get('description', '')
    
    if not name:
        return jsonify({"error": "Category name is required"}), 400
        
    existing = Category.query.filter(Category.name.ilike(name)).first()
    if existing:
        return jsonify({"error": "Category with this name already exists"}), 400
        
    is_approved = (user.role == 'admin')
    
    slug = name.lower().replace(' ', '-')
    if Category.query.filter_by(slug=slug).first():
        slug = f"{slug}-{uuid4().hex[:4]}"

    image_filename = None
    if file and file.filename:
        filename = secure_filename(file.filename)
        unique_name = f"{uuid4().hex}_{filename}"
        save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_name)
        file.save(save_path)
        image_filename = unique_name

    cat = Category(
        name=name,
        slug=slug,
        description=description,
        image=image_filename,
        seller_id=user_id,
        is_approved=is_approved
    )
    db.session.add(cat)
    db.session.commit()
    
    perm = CategoryPermission(category_id=cat.id, user_id=user_id, permission_level='admin')
    db.session.add(perm)
    db.session.commit()
    
    emit_update('category', 'created', cat.to_dict())
    
    return jsonify(cat.to_dict()), 201

@seller_bp.route('/coupons', methods=['GET'])
@role_required('seller', 'admin')
def seller_list_coupons():
    user_id = get_jwt_identity()
    coupons = Coupon.query.filter_by(seller_id=user_id).all()
    return jsonify([{
        "id": c.id,
        "code": c.code,
        "type": c.type,
        "discount_percent": c.discount_percent,
        "max_discount_amount": c.max_discount_amount,
        "min_order_value": c.min_order_value,
        "expiry_date": c.expiry_date.isoformat() if c.expiry_date else None,
        "usage_limit": c.usage_limit,
        "used_count": c.used_count,
        "is_active": c.is_active
    } for c in coupons])

@seller_bp.route('/coupons/<int:id>', methods=['DELETE'])
@role_required('seller', 'admin')
def seller_delete_coupon(id):
    user_id = get_jwt_identity()
    coupon = Coupon.query.filter_by(id=id, seller_id=user_id).first_or_404()
    db.session.delete(coupon)
    db.session.commit()
    return jsonify(message="Coupon deleted")
