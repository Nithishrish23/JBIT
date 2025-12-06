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

    try:
        cursor.execute("ALTER TABLE category ADD COLUMN image VARCHAR(255)")
        print("Added column 'image' to 'category' table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column 'image' already exists in 'category' table.")
        else:
            print(f"Error adding column: {e}")

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()