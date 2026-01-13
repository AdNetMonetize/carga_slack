

import os
import hashlib
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

JWT_SECRET = os.getenv('JWT_SECRET_KEY')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET_KEY environment variable must be set.")
TOKEN_EXPIRY_HOURS = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 3600)) / 3600


class AuthManager:
    
    def __init__(self, db_manager):
        self.db = db_manager
        self._ensure_users_table()
    
    def _ensure_users_table(self):
        conn = None
        try:
            conn = self.db._get_connection()
            if not conn:
                return
            
            cursor = conn.cursor()
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                email VARCHAR(100) UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('admin', 'viewer') DEFAULT 'viewer',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
            """)
            conn.commit()
            

            cursor.execute("SELECT id FROM users WHERE username = 'admin'")
            if not cursor.fetchone():
                admin_hash = self._hash_password('admin123')
                cursor.execute(
                    "INSERT INTO users (username, email, password_hash, role) VALUES (%s, %s, %s, %s)",
                    ('admin', 'admin@example.com', admin_hash, 'admin')
                )
                conn.commit()
            
            cursor.close()
                
        except Exception as e:
            logging.error(f"Erro ao criar tabela de usuários: {e}")
        finally:
            if conn:
                conn.close()
    
    def _hash_password(self, password: str) -> str:
        """Gera um hash seguro usando werkzeug."""
        return generate_password_hash(password)
    
    def _verify_password(self, password: str, password_hash: str) -> bool:
        """Verifica a senha, suportando fallback para o método antigo de SHA256."""
        if not password_hash:
            return False
            

        if password_hash.startswith(('scrypt:', 'pbkdf2:sha256:', 'pbkdf2:sha512:')):
            return check_password_hash(password_hash, password)
        

        salt = JWT_SECRET[:16]
        old_hash = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
        if old_hash == password_hash:
            return True
            
        fallback_salt = 'change-this-secret-key-in-production'[:16]
        fallback_hash = hashlib.sha256(f"{fallback_salt}{password}".encode()).hexdigest()
        return fallback_hash == password_hash
    
    def _generate_token(self, user_id: int, username: str, role: str, expiry_seconds: int = None) -> str:
        if expiry_seconds is None:
            expiry_seconds = int(TOKEN_EXPIRY_HOURS * 3600)
            
        timestamp = int(datetime.now().timestamp())
        expiry = int((datetime.now() + timedelta(seconds=expiry_seconds)).timestamp())
        data = f"{user_id}:{username}:{role}:{expiry}"
        signature = hashlib.sha256(f"{data}:{JWT_SECRET}".encode()).hexdigest()[:32]
        return f"{data}:{signature}"
    
    def _verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        try:
            parts = token.split(':')
            if len(parts) != 5:
                return None
            
            user_id, username, role, expiry, signature = parts
            

            if int(expiry) < int(datetime.now().timestamp()):
                return None
            

            data = f"{user_id}:{username}:{role}:{expiry}"
            expected_sig = hashlib.sha256(f"{data}:{JWT_SECRET}".encode()).hexdigest()[:32]
            
            if signature != expected_sig:
                return None
            
            return {
                'user_id': int(user_id),
                'username': username,
                'role': role
            }
        except Exception:
            return None
    
    def login(self, username: str, password: str, remember_me: bool = False) -> Optional[Dict[str, Any]]:
        conn = None
        try:
            conn = self.db._get_connection()
            if not conn:
                logging.error(f"Falha ao obter conexão com o banco de dados para login do usuário: {username}")
                return None
            
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                "SELECT id, username, email, password_hash, role, must_change_password FROM users WHERE username = %s OR email = %s",
                (username, username)
            )
            user = cursor.fetchone()
            cursor.close()
            
            if not user:
                logging.warning(f"Tentativa de login falhou: Usuário '{username}' não encontrado.")
                return None
            
            if not self._verify_password(password, user['password_hash']):
                logging.warning(f"Tentativa de login falhou: Senha incorreta para o usuário '{username}'.")
                return None
            
            logging.info(f"Usuário '{username}' logado com sucesso.")

            if not user['password_hash'].startswith(('scrypt:', 'pbkdf2:sha256:', 'pbkdf2:sha512:')):
                new_hash = self._hash_password(password)
                try:
                    update_conn = self.db._get_connection()
                    if update_conn:
                        update_cursor = update_conn.cursor()
                        update_cursor.execute(
                            "UPDATE users SET password_hash = %s WHERE id = %s",
                            (new_hash, user['id'])
                        )
                        update_conn.commit()
                        update_cursor.close()
                        update_conn.close()
                except Exception as e:
                    logging.error(f"Erro ao migrar hash de senha: {e}")
            

            expiry = 30 * 24 * 3600 if remember_me else None
            token = self._generate_token(user['id'], user['username'], user['role'], expiry)
            
            return {
                'token': token,
                'user': {
                    'id': user['id'],
                    'username': user['username'],
                    'email': user['email'],
                    'role': user['role'],
                    'must_change_password': bool(user['must_change_password'])
                }
            }
            
        except Exception as e:
            logging.error(f"Erro no login: {e}")
            return None
        finally:
            if conn:
                conn.close()
    
    def verify_request(self, token: str) -> Optional[Dict[str, Any]]:
        return self._verify_token(token)

    def change_password(self, user_id: int, new_password: str) -> bool:
        conn = None
        try:
            conn = self.db._get_connection()
            if not conn:
                return False
                
            password_hash = self._hash_password(new_password)
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET password_hash = %s, must_change_password = FALSE WHERE id = %s",
                (password_hash, user_id)
            )
            conn.commit()
            cursor.close()
            return True
        except Exception as e:
            logging.error(f"Erro ao alterar senha: {e}")
            return False
        finally:
            if conn:
                conn.close()
            
    def create_user(self, username: str, email: str, password: str, role: str = 'viewer', must_change_password: bool = False) -> bool:
        conn = None
        try:
            conn = self.db._get_connection()
            if not conn:
                return False
            
            password_hash = self._hash_password(password)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (username, email, password_hash, role, must_change_password) VALUES (%s, %s, %s, %s, %s)",
                (username, email, password_hash, role, must_change_password)
            )
            conn.commit()
            cursor.close()
            return True
            
        except Exception as e:
            logging.error(f"Erro ao criar usuário: {e}")
            return False
        finally:
            if conn:
                conn.close()
    
    def get_all_users(self) -> list:
        conn = None
        try:
            conn = self.db._get_connection()
            if not conn:
                return []
            
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT id, username, email, role, created_at FROM users")
            result = cursor.fetchall()
            cursor.close()
            return result
            
        except Exception as e:
            logging.error(f"Erro ao buscar usuários: {e}")
            return []
        finally:
            if conn:
                conn.close()

    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        conn = None
        try:
            conn = self.db._get_connection()
            if not conn:
                return None
            
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT id, username, email, role, created_at FROM users WHERE id = %s", (user_id,))
            result = cursor.fetchone()
            cursor.close()
            return result
            
        except Exception as e:
            logging.error(f"Erro ao buscar usuário por ID: {e}")
            return None
        finally:
            if conn:
                conn.close()

    def delete_user(self, user_id: int) -> bool:
        conn = None
        try:
            conn = self.db._get_connection()
            if not conn:
                return False
                
            cursor = conn.cursor()
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
            conn.commit()
            
            deleted = cursor.rowcount > 0
            cursor.close()
            return deleted
            
        except Exception as e:
            logging.error(f"Erro ao deletar usuário: {e}")
            return False
        finally:
            if conn:
                conn.close()

    def update_user(self, user_id: int, data: Dict[str, Any]) -> bool:
        conn = None
        try:
            conn = self.db._get_connection()
            if not conn:
                return False
                
            updates = []
            params = []
            
            if 'username' in data:
                updates.append("username = %s")
                params.append(data['username'])
                
            if 'email' in data:
                updates.append("email = %s")
                params.append(data['email'])
                
            if 'role' in data:
                updates.append("role = %s")
                params.append(data['role'])
                
            if 'password' in data and data['password']:
                password_hash = self._hash_password(data['password'])
                updates.append("password_hash = %s")
                params.append(password_hash)
            
            if not updates:
                return False
                
            query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
            params.append(user_id)
            
            cursor = conn.cursor()
            cursor.execute(query, tuple(params))
            conn.commit()
            
            updated = cursor.rowcount > 0 or True
            cursor.close()
            return updated
            
        except Exception as e:
            logging.error(f"Erro ao atualizar usuário: {e}")
            return False
        finally:
            if conn:
                conn.close()
