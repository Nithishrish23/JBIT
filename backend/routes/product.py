from flask import Blueprint, request, jsonify, abort
from models import Product, User, Inventory, Review, Category
from extensions import db
from utils import get_setting

product_bp = Blueprint('product', __name__)

@product_bp.route('', methods=['GET'])
def list_products():
    category_slug = request.args.get('category')
    brand = request.args.get('brand')
    min_price = request.args.get('min_price')
    max_price = request.args.get('max_price')
    in_stock = request.args.get('in_stock')
    sort_by = request.args.get('sort_by', 'relevance')
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 10, type=int)

    query = Product.query.join(User, Product.seller_id == User.id).filter(
        Product.status == 'approved',
        User.is_approved == True,
        User.is_active == True
    )
    if category_slug:
        query = query.join(Category).filter(Category.slug == category_slug)
    
    if brand:
        query = query.filter(Product.brand == brand)
    
    if min_price:
        try: query = query.filter(Product.price >= float(min_price))
        except: pass
        
    if max_price:
        try: query = query.filter(Product.price <= float(max_price))
        except: pass

    if in_stock == 'true':
        query = query.join(Inventory).filter(Inventory.stock_qty > 0)
    
    if sort_by == 'price_low_high':
        query = query.order_by(Product.price.asc())
    elif sort_by == 'price_high_low':
        query = query.order_by(Product.price.desc())
    elif sort_by == 'popularity':
        query = query.order_by(Product.review_count.desc(), Product.average_rating.desc())
    elif sort_by == 'newest':
        query = query.order_by(Product.created_at.desc())
    else:
        query = query.order_by(Product.created_at.desc())

    pagination = query.paginate(page=page, per_page=limit, error_out=False)

    return jsonify({
        "items": [p.to_dict() for p in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": pagination.page,
        "per_page": pagination.per_page
    })

@product_bp.route('/filters', methods=['GET'])
def get_product_filters():
    category_slug = request.args.get('category')
    query = Product.query.join(User).filter(Product.status == 'approved', User.is_approved == True, User.is_active == True)
    if category_slug:
        query = query.join(Category).filter(Category.slug == category_slug)
    brands = [r[0] for r in query.with_entities(Product.brand).distinct().all() if r[0]]
    price_stats = query.with_entities(db.func.min(Product.price), db.func.max(Product.price)).first()
    return jsonify({"brands": brands, "min_price": price_stats[0] or 0, "max_price": price_stats[1] or 0})

@product_bp.route('/featured', methods=['GET'])
def get_featured_products():
    products = Product.query.join(User, Product.seller_id == User.id).filter(
        Product.status == 'approved', User.is_approved == True, User.is_active == True
    ).limit(16).all()
    return jsonify([p.to_dict() for p in products])

@product_bp.route('/<int:product_id>', methods=['GET'])
def get_product(product_id):
    product = Product.query.get_or_404(product_id)
    if product.status != 'approved':
        abort(403, description="Product not approved")
    if not product.seller.is_approved or not product.seller.is_active:
        abort(403, description="Seller is inactive")
    return jsonify(product.to_dict())

@product_bp.route('/<int:product_id>/reviews', methods=['GET'])
def get_product_reviews(product_id):
    Product.query.get_or_404(product_id)
    reviews = Review.query.filter_by(product_id=product_id).order_by(Review.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reviews])

@product_bp.route('/<int:product_id>/reviews', methods=['POST'])
def add_product_review(product_id):
    # Requires Auth, importing here to avoid circular if needed, or better use decorator
    from flask_jwt_extended import jwt_required, get_jwt_identity
    @jwt_required()
    def _add_review():
        user_id = int(get_jwt_identity())
        product = Product.query.get_or_404(product_id)
        data = request.json or {}
        rating = data.get('rating')
        comment = data.get('comment')
        if not rating: abort(400, description="Rating required")
        
        existing = Review.query.filter_by(product_id=product_id, user_id=user_id).first()
        if existing: abort(400, description="Already reviewed")
        
        review = Review(product_id=product_id, user_id=user_id, rating=rating, comment=comment)
        db.session.add(review)
        
        # Update stats
        current_total = (product.average_rating or 0) * (product.review_count or 0)
        new_count = (product.review_count or 0) + 1
        product.average_rating = (current_total + float(rating)) / new_count
        product.review_count = new_count
        
        db.session.commit()
        return jsonify(review.to_dict()), 201
    return _add_review()

@product_bp.route('/search', methods=['GET'])
def search_products():
    search_query = request.args.get('q', '')
    if not search_query: return jsonify([])
    products = Product.query.filter(Product.name.ilike(f"%{search_query}%"), Product.status == 'approved').all()
    return jsonify([p.to_dict() for p in products])
