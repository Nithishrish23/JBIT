
import pytest
from app import app, db, User, Product, Inventory

@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.session.remove()
            db.drop_all()

@pytest.fixture
def seller_auth_headers(client):
    # Create seller
    seller = User(name='Seller', email='seller@test.com', role='seller', is_active=True, is_approved=True)
    seller.set_password('password')
    db.session.add(seller)
    db.session.commit()
    
    # Login
    resp = client.post('/api/auth/login', json={
        'email': 'seller@test.com',
        'password': 'password'
    })
    token = resp.json['access_token']
    return {'Authorization': f'Bearer {token}'}

def test_seller_edit_product(client, seller_auth_headers):
    # Create a product for the seller
    with app.app_context():
        seller = User.query.filter_by(email='seller@test.com').first()
        product = Product(
            seller_id=seller.id,
            category_id=1, # Assuming dummy category
            name='Old Name',
            description='Old Desc',
            price=100.0,
            status='approved'
        )
        db.session.add(product)
        db.session.flush()
        inv = Inventory(product_id=product.id, stock_qty=10)
        db.session.add(inv)
        db.session.commit()
        product_id = product.id

    # Update payload
    update_data = {
        'name': 'New Name',
        'description': 'New Desc',
        'price': 150.0,
        'quantity': 20,
        'image_url': 'http://example.com/image.png' # Optional handling
    }

    # Call PUT endpoint
    resp = client.put(f'/api/seller/products/{product_id}', json=update_data, headers=seller_auth_headers)
    
    assert resp.status_code == 200
    data = resp.json
    assert data['name'] == 'New Name'
    assert data['description'] == 'New Desc'
    assert data['price'] == 150.0
    assert data['stock_qty'] == 20

    # Verify DB
    with app.app_context():
        p = Product.query.get(product_id)
        assert p.name == 'New Name'
        assert p.price == 150.0
        assert p.inventory.stock_qty == 20

def test_seller_edit_other_product(client, seller_auth_headers):
    # Create another seller and product
    with app.app_context():
        other = User(name='Other', email='other@test.com', role='seller')
        other.set_password('pwd')
        db.session.add(other)
        db.session.commit()
        
        product = Product(seller_id=other.id, category_id=1, name='Other Prod', price=10, status='approved')
        db.session.add(product)
        db.session.commit()
        product_id = product.id

    resp = client.put(f'/api/seller/products/{product_id}', json={'name': 'Hacked'}, headers=seller_auth_headers)
    assert resp.status_code == 404 # Or 403, usually 404 if filtering by seller_id in query
