import sqlite3
import os

# Path to the database
db_path = os.path.join('backend', 'instance', 'ecommerce.db')

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

    # Create SupportTicket table
    create_table(cursor, """
    CREATE TABLE IF NOT EXISTS support_ticket (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        email VARCHAR(120),
        subject VARCHAR(200),
        message TEXT,
        status VARCHAR(20) DEFAULT 'open', -- open, closed, in_progress
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES user(id)
    )
    """)

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
