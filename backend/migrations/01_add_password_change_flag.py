import os
import sys

# Add src to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.db_manager import DBManager

def migrate():
    print("Iniciando migração...")
    db = DBManager()
    db.connect()
    
    try:
        cursor = db.connection.cursor()
        
        # Check if column exists
        check_query = """
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'must_change_password'
        """
        cursor.execute(check_query)
        exists = cursor.fetchone()[0]
        
        if not exists:
            print("Adicionando coluna 'must_change_password'...")
            cursor.execute("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE")
            db.connection.commit()
            print("Coluna adicionada com sucesso!")
        else:
            print("Coluna 'must_change_password' já existe.")
            
        # Set for specific user if needed for testing
        print("Definindo flag para teste no usuário 'gustavo'...")
        cursor.execute("UPDATE users SET must_change_password = TRUE WHERE username = 'gustavo'")
        db.connection.commit()
        
    except Exception as e:
        print(f"Erro na migração: {e}")
    finally:
        db.disconnect()

if __name__ == "__main__":
    migrate()
