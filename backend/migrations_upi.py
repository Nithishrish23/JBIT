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

def migrate():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}. Skipping migration.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Add UPI ID to User table
    add_column(cursor, 'user', 'upi_id', 'VARCHAR(50)')
    
    # Add preferred payout method to User table (optional, but good for defaults)
    add_column(cursor, 'user', 'preferred_payout_method', 'VARCHAR(20)') # 'bank' or 'upi'

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
