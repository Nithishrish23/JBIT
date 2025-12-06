import os
import sys
import shutil
import glob
import random
from datetime import datetime
from uuid import uuid4
from werkzeug.security import generate_password_hash

# Add the backend directory to the path to import app and db
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app, db, User, Category, Product, Inventory, File, ProductImage, Advertisement, Setting # Import necessary models

def init_db_with_data():
    with app.app_context():
        print(f"DEBUG: app.root_path: {app.root_path}")
        print(f"DEBUG: SQLALCHEMY_DATABASE_URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
        
        # Ensure the instance directory exists for the DB file
        instance_dir = os.path.join(app.root_path, 'instance')
        os.makedirs(instance_dir, exist_ok=True)
        
        db_path = os.path.join(instance_dir, 'ecommerce.db')

        print("Creating all database tables...")
        db.drop_all()
        db.create_all()
        print("Tables created.")

        print("Populating initial data...")

        # Create Users
        admin_user = User(name='Admin User', email='admin@admin.com', role='admin', is_active=True, is_approved=True)
        admin_user.set_password('admin123')
        
        seller_user = User(name='Seller One', email='seller@example.com', role='seller', is_active=True, is_approved=True)
        seller_user.set_password('seller123')

        customer_user = User(name='Customer User', email='user@example.com', role='user', is_active=True, is_approved=False)
        customer_user.set_password('user123')
        
        db.session.add_all([admin_user, seller_user, customer_user])
        db.session.commit()
        print("Users created: Admin, Seller, Customer.")

        # Create Categories
        category_laptops = Category(name='Laptops', slug='laptops', description='High performance laptops for work and play')
        category_mobiles = Category(name='Mobiles', slug='mobiles', description='Latest smartphones and tablets')
        category_accessories = Category(name='Accessories', slug='accessories', description='Headphones, keyboards, mice and more')
        
        db.session.add_all([category_laptops, category_mobiles, category_accessories])
        db.session.commit()
        print("Categories created: Laptops, Mobiles, Accessories.")

        # Ensure UPLOAD_FOLDER exists
        upload_folder = app.config['UPLOAD_FOLDER']
        os.makedirs(upload_folder, exist_ok=True)

        # Dictionary to hold file IDs for ads
        ad_images = {}
        logo_image_id = None

        # Process images from processed_images folder for Electronics
        processed_images_dir = os.path.abspath(os.path.join(app.root_path, '..', 'processed_images'))
        
        # Product Titles for Electronics
        electronics_titles = [
            "Pro Gaming Laptop 15", "UltraSlim Notebook Air", "Smartphone Galaxy X", 
            "Phone 14 Pro Max", "Noise Cancelling Headphones", "True Wireless Earbuds", 
            "Mechanical RGB Keyboard", "Wireless Ergonomic Mouse", "27-inch 4K Monitor", 
            "Smart Watch Series 5", "Tablet Pro 11", "Portable SSD 1TB", 
            "High Capacity Power Bank"
        ]

        if os.path.exists(processed_images_dir):
            print(f"Found processed_images directory at: {processed_images_dir}")
            image_files = glob.glob(os.path.join(processed_images_dir, '*.png'))
            # Sort to ensure consistent order (image_01, image_02, etc.)
            image_files.sort() 
            
            for idx, img_path in enumerate(image_files):
                filename = os.path.basename(img_path)
                title = electronics_titles[idx] if idx < len(electronics_titles) else f"Electronic Gadget {idx+1}"
                
                # Determine category based on title (simple logic)
                if "Laptop" in title or "Notebook" in title:
                    cat_id = category_laptops.id
                elif "Phone" in title or "Tablet" in title:
                    cat_id = category_mobiles.id
                else:
                    cat_id = category_accessories.id

                # Generate a description
                description = (
                    f"Experience cutting-edge technology with the {title}. "
                    "Features high-speed performance, durable build quality, and a 1-year manufacturer warranty. "
                    "Perfect for professionals and tech enthusiasts alike."
                )
                
                # Copy image to uploads
                unique_filename = f"{uuid4().hex}_{filename}"
                dest_path = os.path.join(upload_folder, unique_filename)
                shutil.copy2(img_path, dest_path)
                
                # Create File record
                file_record = File(
                    owner_id=seller_user.id,
                    filename=filename,
                    stored_filename=unique_filename,
                    filepath=dest_path,
                    size=os.path.getsize(dest_path),
                    status='active'
                )
                db.session.add(file_record)
                db.session.flush()
                
                # Save specific images for Ads
                if 'image_01' in filename:
                    ad_images[0] = file_record.id
                elif 'image_02' in filename:
                    ad_images[2] = file_record.id
                elif 'image_04' in filename:
                    ad_images[1] = file_record.id
                elif 'image_03' in filename:
                    logo_image_id = file_record.id
                
                # Create Product
                product = Product(
                    seller_id=seller_user.id,
                    category_id=cat_id,
                    name=title,
                    description=description,
                    price=random.randint(1000, 150000),
                    status='approved',
                    sku=f'JBIT-ELC-{idx+1:03d}'
                )
                db.session.add(product)
                db.session.flush()
                
                # Create Inventory
                inventory = Inventory(product_id=product.id, stock_qty=random.randint(5, 50))
                db.session.add(inventory)
                
                # Link Image
                product_image = ProductImage(product_id=product.id, file_id=file_record.id, position=0)
                db.session.add(product_image)
                
                print(f"Added Product from {filename}: {title}")
        else:
            print(f"Warning: processed_images directory not found at {processed_images_dir}")
            # Create dummy products if no images found
            for idx, title in enumerate(electronics_titles[:5]):
                 # Create Product without image
                if "Laptop" in title: cat_id = category_laptops.id
                elif "Phone" in title: cat_id = category_mobiles.id
                else: cat_id = category_accessories.id

                product = Product(
                    seller_id=seller_user.id,
                    category_id=cat_id,
                    name=title,
                    description=f"Experience cutting-edge technology with the {title}. Premium quality guaranteed.",
                    price=random.randint(1000, 150000),
                    status='approved',
                    sku=f'JBIT-ELC-{idx+1:03d}'
                )
                db.session.add(product)
                db.session.flush()
                inventory = Inventory(product_id=product.id, stock_qty=random.randint(5, 50))
                db.session.add(inventory)
                print(f"Added Dummy Product: {title}")


        # Create Advertisements
        # Helper to safe get URL
        def get_img_url(fid, text="Tech"):
            return f"/api/files/{fid}/download" if fid else f"https://placehold.co/1200x400/0f172a/ffffff?text={text}"

        logo_url = f"/api/files/{logo_image_id}/download" if logo_image_id else "https://placehold.co/150x50/2563eb/ffffff?text=JB+IT"
        
        # Settings
        settings_data = [
            Setting(key='site_title', value='JB Solutions'),
            Setting(key='site_logo', value=logo_url),
            Setting(key='home_banner_heading', value='Future of Tech'),
            Setting(key='home_banner_subheading', value='Discover the latest electronics at unbeatable prices.'),
            Setting(key='theme_brand_primary', value='#0f172a'), # Slate 900
            Setting(key='theme_text_primary', value='#000000'), # Black
            Setting(key='theme_text_secondary', value='#000000'), # Black for secondary too if requested, but standard practice is distinct. User asked for "admin seller and user text in black". This might imply all text. Let's stick to primary black.
            Setting(key='theme_button_bg', value='#2563eb'), # Blue 600
            Setting(key='theme_header_bg', value='#ffffff'),
            Setting(key='theme_header_text', value='#0f172a'),
            Setting(key='theme_footer_bg', value='#0f172a'),
            Setting(key='theme_footer_text', value='#f8fafc'),
            Setting(key='theme_status_success', value='#10b981'),
            Setting(key='theme_status_warning', value='#f59e0b'),
            Setting(key='theme_status_error', value='#ef4444'),
            Setting(key='theme_status_info', value='#3b82f6'),
        ]
        db.session.add_all(settings_data)


        ad1 = Advertisement(
            title="JB Solutions",
            text="Your one-stop shop for laptops, mobiles, and accessories.",
            image_url=get_img_url(ad_images.get(0), "JB+IT+Solutions"), 
            footer_logo_url=logo_url,
            position="home_banner",
            priority=10,
            is_active=True,
            start_date=datetime.utcnow(),
            target_roles="user"
        )
        ad2 = Advertisement(
            title="Latest Tech Deals",
            text="Up to 40% off on premium gadgets.",
            image_url=get_img_url(ad_images.get(1), "Tech+Deals"), 
            footer_logo_url=logo_url,
            position="home_banner",
            priority=8,
            is_active=True,
            start_date=datetime.utcnow(),
            target_roles="user"
        )
        ad3 = Advertisement(
            title="Smart Living",
            text="Upgrade your home with our smart devices.",
            image_url=get_img_url(ad_images.get(2), "Smart+Home"),
            footer_logo_url=logo_url,
            position="home_banner",
            priority=5,
            is_active=True,
            start_date=datetime.utcnow(),
            target_roles="user"
        )
        db.session.add_all([ad1, ad2, ad3])
        db.session.commit()
        print("Advertisements and Settings created.")
        
        db.session.commit()
        print("Initial data population complete.")

if __name__ == "__main__":
    init_db_with_data()