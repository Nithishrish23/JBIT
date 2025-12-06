import sqlite3
import os

# Path to the database
db_path = os.path.join('backend', 'instance', 'ecommerce.db')

def add_column(cursor, table_name, column_name, column_type):
    try:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
        print(f"Added column {column_name} to {table_name}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print(f"Column {column_name} already exists in {table_name}")
        else:
            print(f"Error adding {column_name} to {table_name}: {e}")

def create_table(cursor, create_statement):
    try:
        cursor.execute(create_statement)
        print("Table created successfully.")
    except sqlite3.OperationalError as e:
        print(f"Error creating table: {e}")

def migrate():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}. Skipping migration.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Add MRP to Product table
    add_column(cursor, 'product', 'mrp', 'FLOAT DEFAULT 0')

    # Add coupon_id to Cart table
    add_column(cursor, 'cart', 'coupon_code', 'VARCHAR(50)')

    # Create Coupon table
    # seller_id NULL means Admin-wide coupon
    create_table(cursor, """
    CREATE TABLE IF NOT EXISTS coupon (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code VARCHAR(50) UNIQUE NOT NULL,
        type VARCHAR(20) DEFAULT 'admin', -- admin, seller
        discount_percent FLOAT NOT NULL,
        max_discount_amount FLOAT,
        min_order_value FLOAT DEFAULT 0,
        expiry_date DATETIME,
        usage_limit INTEGER DEFAULT 0,
        used_count INTEGER DEFAULT 0,
        seller_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(seller_id) REFERENCES user(id)
    )
    """)

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
