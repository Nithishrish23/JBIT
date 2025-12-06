from extensions import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask import request

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='user')  # admin, seller, user, delivery
    is_active = db.Column(db.Boolean, default=True)
    is_approved = db.Column(db.Boolean, default=False) # Added for seller approval
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    phone = db.Column(db.String(20))
    profile_photo_id = db.Column(db.Integer, db.ForeignKey('file.id'))

    profile_photo = db.relationship('File', foreign_keys=[profile_photo_id])

    # Bank Details for Sellers
    bank_account_number = db.Column(db.String(50))
    bank_ifsc = db.Column(db.String(20))
    bank_beneficiary_name = db.Column(db.String(100))
    upi_id = db.Column(db.String(50))
    preferred_payout_method = db.Column(db.String(20), default='bank') # 'bank' or 'upi'
    razorpay_fund_account_id = db.Column(db.String(100))
    razorpay_contact_id = db.Column(db.String(100))
    gst_number = db.Column(db.String(20)) # Added GST Number
    
    # Multi-tenancy & Onboarding
    client_id = db.Column(db.String(36)) # Link to SuperAdmin Client ID
    is_first_login = db.Column(db.Boolean, default=False) # If true, force onboarding
    shop_details = db.Column(db.JSON, default={}) # Store shop name, address extra info

    def set_password(self, pwd):
        self.password_hash = generate_password_hash(pwd)

    def check_password(self, pwd):
        return check_password_hash(self.password_hash, pwd)

    def to_dict(self):
        # Fetch address if available (default one preferably)
        address = None
        if self.addresses:
            default_addr = next((a for a in self.addresses if a.is_default), None)
            if default_addr:
                address = default_addr.to_dict()
            elif len(self.addresses) > 0:
                address = self.addresses[0].to_dict()

        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "is_approved": self.is_approved,
            "phone": self.phone,
            "gst_number": self.gst_number,
            "client_id": self.client_id,
            "is_first_login": self.is_first_login,
            "shop_details": self.shop_details,
            "address": address, # Full address object
            "profile_photo": f"/api/files/{self.profile_photo_id}/download" if self.profile_photo_id else None
        }


class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True) # Enforce unique name
    slug = db.Column(db.String(120), unique=True, nullable=False)
    description = db.Column(db.Text, default="")
    image = db.Column(db.String(255)) # Category Image
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True) # Nullable for admin/global categories
    is_approved = db.Column(db.Boolean, default=False) # For seller defined categories

    seller = db.relationship('User', foreign_keys=[seller_id])

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "image": self.image,
            "image_url": f"/api/uploads/{self.image}" if self.image and not self.image.startswith('http') else self.image,
            "seller_id": self.seller_id,
            "is_approved": self.is_approved,
            "seller_name": self.seller.name if self.seller else "System"
        }

class CategoryPermission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    permission_level = db.Column(db.String(20), default='read') # read, write, admin

    category = db.relationship('Category')
    user = db.relationship('User')


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default="")
    price = db.Column(db.Float, nullable=False)
    mrp = db.Column(db.Float, default=0.0) # Maximum Retail Price
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    sku = db.Column(db.String(50)) # Added SKU
    average_rating = db.Column(db.Float, default=0.0)
    review_count = db.Column(db.Integer, default=0)
    brand = db.Column(db.String(100))
    specifications = db.Column(db.JSON) 

    seller = db.relationship('User', backref='products')
    category = db.relationship('Category', backref='products')
    inventory = db.relationship('Inventory', backref='product', uselist=False)

    def to_dict(self):
        return {
            "id": self.id,
            "seller_id": self.seller_id,
            "category_id": self.category_id,
            "name": self.name,
            "description": self.description,
            "is_approved": self.status == 'approved', 
            "price": self.price,
            "mrp": self.mrp,
            "discount_percent": int(((self.mrp - self.price) / self.mrp * 100)) if self.mrp > self.price else 0,
            "status": self.status,
            "stock_qty": self.inventory.stock_qty if self.inventory else 0,
            "images": self._image_list(),
            "sku": self.sku,
            "average_rating": self.average_rating,
            "review_count": self.review_count,
            "brand": self.brand,
            "specifications": self.specifications,
            "seller": {
                "name": self.seller.name if self.seller else "Unknown",
                "email": self.seller.email if self.seller else ""
            }
        }

    def _image_list(self):
        try:
            imgs = []
            for pi in sorted(getattr(self, 'product_images', []) or [], key=lambda x: (x.position or 0)):
                if pi.file:
                    imgs.append({
                        "id": pi.file.id,
                        "filename": pi.file.filename,
                        "download_url": f"{request.url_root.rstrip('/')}/api/files/{pi.file.id}/download"
                    })
            return imgs
        except Exception:
            return []


class Coupon(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    type = db.Column(db.String(20), default='admin') # admin, seller
    discount_percent = db.Column(db.Float, nullable=False)
    max_discount_amount = db.Column(db.Float)
    min_order_value = db.Column(db.Float, default=0)
    expiry_date = db.Column(db.DateTime)
    usage_limit = db.Column(db.Integer, default=0) # 0 = unlimited
    used_count = db.Column(db.Integer, default=0)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True) # If type=seller
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    seller = db.relationship('User')

class Inventory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), unique=True)
    stock_qty = db.Column(db.Integer, default=0)
    low_stock_threshold = db.Column(db.Integer, default=5)


class ProductImage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    file_id = db.Column(db.Integer, db.ForeignKey('file.id'), nullable=False)
    position = db.Column(db.Integer, default=0)

    product = db.relationship('Product', backref='product_images')
    file = db.relationship('File')


class Cart(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True)
    coupon_code = db.Column(db.String(50))
    user = db.relationship('User', backref='cart')


class CartItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cart_id = db.Column(db.Integer, db.ForeignKey('cart.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, default=1)

    cart = db.relationship('Cart', backref='items')
    product = db.relationship('Product')


class Wishlist(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True)
    user = db.relationship('User', backref='wishlist')


class WishlistItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    wishlist_id = db.Column(db.Integer, db.ForeignKey('wishlist.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)

    wishlist = db.relationship('Wishlist', backref='items')
    product = db.relationship('Product')


class Address(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    address_line_1 = db.Column(db.String(255), nullable=False)
    city = db.Column(db.String(100), nullable=False)
    state = db.Column(db.String(100), nullable=False)
    postal_code = db.Column(db.String(20), nullable=False)
    country = db.Column(db.String(100), default="India")
    is_default = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='addresses')

    def to_dict(self):
        return {
            "id": self.id,
            "address_line_1": self.address_line_1,
            "city": self.city,
            "state": self.state,
            "postal_code": self.postal_code,
            "country": self.country,
            "is_default": self.is_default
        }


class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    total_amount = db.Column(db.Float, default=0)
    status = db.Column(db.String(20), default='pending') 
    payment_status = db.Column(db.String(20), default='unpaid')
    payment_gateway = db.Column(db.String(20))
    payment_reference = db.Column(db.String(120))
    invoice_html = db.Column(db.Text)
    delivery_info = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='orders')


class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)
    subtotal = db.Column(db.Float, nullable=False)

    order = db.relationship('Order', backref='items')
    product = db.relationship('Product')
    seller = db.relationship('User')


class Review(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='reviews')
    product = db.relationship('Product', backref='reviews')

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "user_id": self.user_id,
            "user_name": self.user.name,
            "rating": self.rating,
            "comment": self.comment,
            "created_at": self.created_at.isoformat()
        }


class WithdrawalRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='requested')
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.DateTime)
    payout_id = db.Column(db.String(100)) 
    rejection_reason = db.Column(db.Text)

    seller = db.relationship('User')


class PaymentRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    withdrawal_id = db.Column(db.Integer, db.ForeignKey('withdrawal_request.id'), nullable=True)
    amount = db.Column(db.Float)
    method = db.Column(db.String(64))
    details = db.Column(db.Text)
    paid_at = db.Column(db.DateTime, default=datetime.utcnow)
    admin_id = db.Column(db.Integer, db.ForeignKey('user.id'))

    withdrawal = db.relationship('WithdrawalRequest', backref='payments')
    admin = db.relationship('User')


class PaymentTransaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(10), default='INR')
    payment_status = db.Column(db.String(20), nullable=False)
    payment_gateway = db.Column(db.String(20))
    transaction_id = db.Column(db.String(120))
    failure_reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    order = db.relationship('Order', backref='transactions')


class SellerPurchaseBill(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    supplier_name = db.Column(db.String(200))
    bill_number = db.Column(db.String(100))
    total_amount = db.Column(db.Float)
    bill_date = db.Column(db.DateTime, default=datetime.utcnow)


class SellerSalesBill(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=True)
    bill_number = db.Column(db.String(100))
    total_amount = db.Column(db.Float)
    bill_date = db.Column(db.DateTime, default=datetime.utcnow)


class SellerRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), default='requested')
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
    note = db.Column(db.Text)

    user = db.relationship('User')


class Advertisement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    text = db.Column(db.String(500))
    image_url = db.Column(db.String(255))
    footer_logo_url = db.Column(db.String(255)) 
    target_url = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)
    position = db.Column(db.String(50), default="home_banner")
    priority = db.Column(db.Integer, default=0)
    start_date = db.Column(db.DateTime, nullable=True)
    end_date = db.Column(db.DateTime, nullable=True)
    target_roles = db.Column(db.String(200), nullable=True)
    views = db.Column(db.Integer, default=0)
    clicks = db.Column(db.Integer, default=0)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=True)
    product = db.relationship('Product')

    def to_dict(self):
        data = {
            "id": self.id,
            "title": self.title,
            "text": self.text,
            "image_url": self.image_url,
            "footer_logo_url": self.footer_logo_url,
            "target_url": self.target_url,
            "is_active": self.is_active,
            "position": self.position,
            "priority": self.priority,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "target_roles": self.target_roles,
            "views": self.views,
            "clicks": self.clicks,
            "product_id": self.product_id
        }
        if self.product:
            data['product_name'] = self.product.name
            data['product_price'] = self.product.price
        return data

class NewsletterSubscriber(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    is_confirmed = db.Column(db.Boolean, default=False)
    confirmation_token = db.Column(db.String(100), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    gdpr_consent = db.Column(db.Boolean, default=False)

class SupportTicket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    email = db.Column(db.String(120))
    subject = db.Column(db.String(200))
    message = db.Column(db.Text)
    status = db.Column(db.String(20), default='open')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User')

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else "Guest",
            "email": self.email or (self.user.email if self.user else "Unknown"),
            "subject": self.subject,
            "message": self.message,
            "status": self.status,
            "created_at": self.created_at.isoformat()
        }

class Setting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(200), unique=True, nullable=False)
    value = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class File(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    stored_filename = db.Column(db.String(255), nullable=False, unique=True)
    filepath = db.Column(db.String(1024), nullable=False)
    status = db.Column(db.String(32), default='pending')
    size = db.Column(db.Integer, default=0)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, include_owner=False):
        data = {
            'id': self.id,
            'owner_id': self.owner_id,
            'filename': self.filename,
            'stored_filename': self.stored_filename,
            'status': self.status,
            'size': self.size,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_owner:
            owner = User.query.get(self.owner_id)
            if owner:
                data['owner'] = {'id': owner.id, 'email': owner.email}
        return data

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    subject = db.Column(db.String(200))
    message = db.Column(db.Text)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User')

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "subject": self.subject,
            "message": self.message,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat()
        }