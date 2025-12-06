import sqlite3
import os

# Path to the database - absolute path to be safe
base_dir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(base_dir, 'instance', 'ecommerce.db')

def migrate():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}. Skipping migration.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Add MRP to Product table
    try:
        cursor.execute("ALTER TABLE product ADD COLUMN mrp FLOAT DEFAULT 0.0")
        print("Added column 'mrp' to 'product' table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column 'mrp' already exists in 'product' table.")
        else:
            print(f"Error adding column 'mrp': {e}")

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()