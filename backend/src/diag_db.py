import os
import mysql.connector
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
import hashlib

load_dotenv()

def check_db():
    host = os.getenv('DB_HOST')
    port = int(os.getenv('DB_PORT', 3306))
    user = os.getenv('DB_USER')
    password = os.getenv('DB_PASSWORD')
    database = os.getenv('DB_NAME')
    jwt_secret = os.getenv('JWT_SECRET_KEY')

    print(f"Connecting to {host}:{port}...")
    try:
        conn = mysql.connector.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database
        )
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT username, email, password_hash, must_change_password FROM users")
        users = cursor.fetchall()
        
        print(f"\nFound {len(users)} users:")
        for u in users:
            hash_val = u['password_hash']
            is_werkzeug = hash_val.startswith(('scrypt:', 'pbkdf2:sha256:'))
            
            print(f"- {u['username']} ({u['email']})")
            print(f"  Hash: {hash_val[:20]}... (Is Werkzeug: {is_werkzeug})")
            print(f"  Must change password: {u['must_change_password']}")
            
            # Test 'Cap0199**'
            test_pw = "Cap0199**"
            
            if is_werkzeug:
                match = check_password_hash(hash_val, test_pw)
            else:
                salt = jwt_secret[:16]
                old_hash = hashlib.sha256(f"{salt}{test_pw}".encode()).hexdigest()
                match = (old_hash == hash_val)
                
                if not match:
                    fallback_salt = 'change-this-secret-key-in-production'[:16]
                    fallback_hash = hashlib.sha256(f"{fallback_salt}{test_pw}".encode()).hexdigest()
                    match = (fallback_hash == hash_val)
                    if match:
                        print("  MATCHED with fallback salt!")
            
            print(f"  Current DB password matches 'Cap0199**': {match}")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()
