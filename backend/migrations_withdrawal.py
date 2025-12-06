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

    # Add columns to User table
    add_column(cursor, 'user', 'bank_account_number', 'VARCHAR(50)')
    add_column(cursor, 'user', 'bank_ifsc', 'VARCHAR(20)')
    add_column(cursor, 'user', 'bank_beneficiary_name', 'VARCHAR(100)')
    add_column(cursor, 'user', 'razorpay_fund_account_id', 'VARCHAR(100)')
    add_column(cursor, 'user', 'razorpay_contact_id', 'VARCHAR(100)')

    # Add columns to WithdrawalRequest table
    add_column(cursor, 'withdrawal_request', 'payout_id', 'VARCHAR(100)')
    add_column(cursor, 'withdrawal_request', 'rejection_reason', 'TEXT')

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
