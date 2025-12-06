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

    # Add Notification Table
    try:
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS notification (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject VARCHAR(200),
            message TEXT,
            is_read BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES user(id)
        )
        """)
        print("Created 'notification' table.")
    except sqlite3.OperationalError as e:
        print(f"Error creating table: {e}")

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
