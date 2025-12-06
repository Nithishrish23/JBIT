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

    # Update Category table
    add_column(cursor, 'category', 'seller_id', 'INTEGER REFERENCES user(id)')
    add_column(cursor, 'category', 'is_approved', 'BOOLEAN DEFAULT 0')

    # Create CategoryPermission table
    create_table(cursor, """
    CREATE TABLE IF NOT EXISTS category_permission (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        permission_level VARCHAR(20) DEFAULT 'read', -- read, write, admin
        FOREIGN KEY(category_id) REFERENCES category(id),
        FOREIGN KEY(user_id) REFERENCES user(id)
    )
    """)

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
