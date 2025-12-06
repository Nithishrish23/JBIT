import sys
import os

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db, User

def create_roles():
    with app.app_context():
        # Create Admin
        admin_email = 'admin@example.com'
        admin = User.query.filter_by(email=admin_email).first()
        if not admin:
            print(f"Creating admin user: {admin_email}")
            admin = User(
                name='Admin User', 
                email=admin_email, 
                role='admin', 
                is_active=True, 
                is_approved=True
            )
            admin.set_password('admin123')
            db.session.add(admin)
        else:
            print(f"Admin user {admin_email} already exists.")

        # Create Seller
        seller_email = 'seller@example.com'
        seller = User.query.filter_by(email=seller_email).first()
        if not seller:
            print(f"Creating seller user: {seller_email}")
            seller = User(
                name='Seller User', 
                email=seller_email, 
                role='seller', 
                is_active=True, 
                is_approved=True
            )
            seller.set_password('seller123')
            db.session.add(seller)
        else:
            print(f"Seller user {seller_email} already exists.")

        db.session.commit()
        print("Process completed.")

if __name__ == '__main__':
    create_roles()
