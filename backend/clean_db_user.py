import sqlite3
import os

def clean_user(email):
    # Path to ecommerce.db (User table)
    db_path = os.path.join("instance", "ecommerce.db")
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute("SELECT id, name, email FROM user WHERE email = ?", (email,))
        user = cursor.fetchone()
        
        if user:
            print(f"Found User: ID={user[0]}, Name={user[1]}, Email={user[2]}")
            # Delete
            cursor.execute("DELETE FROM user WHERE email = ?", (email,))
            conn.commit()
            print(f"User '{email}' deleted successfully.")
        else:
            print(f"User '{email}' not found.")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python clean_db_user.py <email>")
        print("Example: python clean_db_user.py nithish@gmail.com")
    else:
        clean_user(sys.argv[1])
