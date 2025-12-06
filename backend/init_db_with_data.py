import os
import sys
import shutil
import glob
import random
from datetime import datetime
from uuid import uuid4
from werkzeug.security import generate_password_hash

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import app
from extensions import db
from models import User, Category, Product, Inventory, File, ProductImage, Advertisement, Setting

def init_db_with_data():
    with app.app_context():
        print("Creating all database tables...")
        db.create_all()
        print("Tables created.")

        if User.query.first():
            print("Data already exists. Skipping population.")
            return

        print("Populating initial data...")

        admin_user = User(name='Admin User', email='admin@admin.com', role='admin', is_active=True, is_approved=True)
        admin_user.set_password('admin123')
        
        seller_user = User(name='Seller One', email='seller@example.com', role='seller', is_active=True, is_approved=True)
        seller_user.set_password('seller123')

        customer_user = User(name='Customer User', email='user@example.com', role='user', is_active=True, is_approved=True)
        customer_user.set_password('user123')
        
        db.session.add_all([admin_user, seller_user, customer_user])
        db.session.commit()

        category_laptops = Category(name='Laptops', slug='laptops', description='High performance laptops')
        category_mobiles = Category(name='Mobiles', slug='mobiles', description='Smartphones')
        
        db.session.add_all([category_laptops, category_mobiles])
        db.session.commit()

        print("Initial data population complete.")

if __name__ == "__main__":
    init_db_with_data()
