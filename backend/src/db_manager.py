

import os
import mysql.connector
from mysql.connector import Error, pooling
import logging
from typing import Dict, Any, List, Optional, Tuple
from dotenv import load_dotenv
import threading

load_dotenv()

class DBManager:
    
    _pool = None
    _pool_lock = threading.Lock()
    
    def __init__(self, host=None, port=None, user=None, password=None, database=None):
        self.host = host or os.getenv('DB_HOST')
        self.port = port or int(os.getenv('DB_PORT', 3306))
        self.user = user or os.getenv('DB_USER')
        self.password = password or os.getenv('DB_PASSWORD')
        self.database = database or os.getenv('DB_NAME')
        self.connection = None 
        
    def connect(self) -> bool:
        try:
            with DBManager._pool_lock:
                if DBManager._pool is None:
                    DBManager._pool = pooling.MySQLConnectionPool(
                        pool_name="mypool",
                        pool_size=10,
                        pool_reset_session=True,
                        host=self.host,
                        port=self.port,
                        user=self.user,
                        password=self.password,
                        database=self.database
                    )
                    logging.info(f"Pool de conexões criado: {self.host}:{self.port}, banco de dados: {self.database}")
            

            conn = self._get_connection()
            if conn and conn.is_connected():
                logging.info(f"Conectado ao MySQL: {self.host}:{self.port}, banco de dados: {self.database}")
                conn.close()
                return True
                
        except Error as e:
            logging.error(f"Erro ao conectar ao MySQL: {e}")
            return False
    
    def _get_connection(self):
        try:
            return DBManager._pool.get_connection()
        except Error as e:
            logging.error(f"Erro ao obter conexão do pool: {e}")
            return None
            
    def disconnect(self) -> None:
        logging.info("DBManager disconnect chamado (pool gerencia conexões automaticamente)")
            
    def _create_tables(self) -> None:        
        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                logging.error("Não foi possível obter uma conexão para criar tabelas.")
                return
            cursor = conn.cursor()
            

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS sites (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                sheet_url TEXT,
                slack_channel_id INT,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            

            cursor.execute("SHOW COLUMNS FROM sites LIKE 'status'")
            if not cursor.fetchone():
                try:
                    cursor.execute("ALTER TABLE sites ADD COLUMN status VARCHAR(20) DEFAULT 'active'")
                    logging.info("Coluna 'status' adicionada à tabela sites")
                except Error as e:
                    logging.warning(f"Erro ao adicionar coluna status: {e}")


            cursor.execute("""
            CREATE TABLE IF NOT EXISTS column_indices (
                id INT AUTO_INCREMENT PRIMARY KEY,
                site_id INT,
                investimento_idx INT,
                receita_idx INT,
                roas_idx INT,
                mc_idx INT,
                FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
            )
            """)
            

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS slack_channels (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                webhook_url TEXT
            )
            """)
            
            conn.commit()
            cursor.close()
            
        except Error as e:
            logging.error(f"Erro ao criar tabelas: {e}")
        finally:
            if conn:
                conn.close()
            
    def add_site(self, name: str, sheet_url: str, investimento_idx: int, 
                receita_idx: int, roas_idx: int, mc_idx: int, 
                squad_name: Optional[str] = None, status: str = 'active') -> bool:
        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return False
                
            cursor = conn.cursor()
            

            channel_id = None
            if squad_name:

                cursor.execute("SELECT id FROM slack_channels WHERE name = %s", (squad_name,))
                channel_result = cursor.fetchone()
                if channel_result:
                    channel_id = channel_result[0]
                else:

                    cursor.execute("SELECT MAX(id) FROM slack_channels")
                    sc_max = cursor.fetchone()
                    next_sc_id = (sc_max[0] or 0) + 1
                    
                    cursor.execute("INSERT INTO slack_channels (id, name, webhook_url) VALUES (%s, %s, '')", (next_sc_id, squad_name))
                    channel_id = next_sc_id

            cursor.execute("SELECT id FROM sites WHERE name = %s", (name,))
            result = cursor.fetchone()
            
            if result:
                site_id = result[0]

                updates = ["sheet_url = %s"]
                params = [sheet_url]
                
                if channel_id:
                    updates.append("slack_channel_id = %s")
                    params.append(channel_id)
                
                if status:
                    updates.append("status = %s")
                    params.append(status)
                
                query = f"UPDATE sites SET {', '.join(updates)} WHERE id = %s"
                params.append(site_id)
                
                cursor.execute(query, tuple(params))
                
                cursor.execute("""
                UPDATE column_indices SET 
                investimento_idx = %s, receita_idx = %s, roas_idx = %s, mc_idx = %s
                WHERE site_id = %s
                """, (investimento_idx, receita_idx, roas_idx, mc_idx, site_id))
            else:


                cursor.execute("SELECT MAX(id) FROM sites")
                result_max = cursor.fetchone()
                next_id = (result_max[0] or 0) + 1


                site_columns = ["id", "name", "sheet_url"]
                site_values = ["%s", "%s", "%s"]
                site_params = [next_id, name, sheet_url]

                if channel_id:
                    site_columns.append("slack_channel_id")
                    site_values.append("%s")
                    site_params.append(channel_id)
                
                if status:
                    site_columns.append("status")
                    site_values.append("%s")
                    site_params.append(status)

                cursor.execute(f"""
                INSERT INTO sites ({', '.join(site_columns)}) VALUES ({', '.join(site_values)})
                """, tuple(site_params))
                
                site_id = next_id
                

                cursor.execute("SELECT MAX(id) FROM column_indices")
                res_max_ci = cursor.fetchone()
                next_ci_id = (res_max_ci[0] or 0) + 1
                
                cursor.execute("""
                INSERT INTO column_indices 
                (id, site_id, investimento_idx, receita_idx, roas_idx, mc_idx)
                VALUES (%s, %s, %s, %s, %s, %s)
                """, (next_ci_id, site_id, investimento_idx, receita_idx, roas_idx, mc_idx))
            
            conn.commit()
            cursor.close()
            logging.info(f"Site '{name}' adicionado/atualizado com sucesso")
            return True
            
        except Error as e:
            logging.error(f"Erro ao adicionar/atualizar site: {e}")
            return False
        finally:
            if conn:
                conn.close()

    def update_site(self, site_id: int, data: Dict[str, Any]) -> bool:
        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return False
                
            cursor = conn.cursor()
            
            updates = []
            params = []
            
            if 'name' in data:
                updates.append("name = %s")
                params.append(data['name'])
            
            if 'sheet_url' in data:
                updates.append("sheet_url = %s")
                params.append(data['sheet_url'])
                
            if 'status' in data:
                updates.append("status = %s")
                params.append(data['status'])
                
            if 'squad_name' in data:
                squad_name = data['squad_name']
                if squad_name:

                    cursor.execute("SELECT id FROM slack_channels WHERE name = %s", (squad_name,))
                    channel_result = cursor.fetchone()
                    if channel_result:
                        channel_id = channel_result[0]
                    else:

                        cursor.execute("SELECT MAX(id) FROM slack_channels")
                        sc_max = cursor.fetchone()
                        next_sc_id = (sc_max[0] or 0) + 1
                        
                        cursor.execute("INSERT INTO slack_channels (id, name, webhook_url) VALUES (%s, %s, '')", (next_sc_id, squad_name))
                        channel_id = next_sc_id
                    
                    updates.append("slack_channel_id = %s")
                    params.append(channel_id)
                else:

                    updates.append("slack_channel_id = NULL")
            
            if updates:
                query = f"UPDATE sites SET {', '.join(updates)} WHERE id = %s"
                params.append(site_id)
                cursor.execute(query, tuple(params))


            indices_updates = []
            indices_params = []
            
            if 'investimento_idx' in data:
                indices_updates.append("investimento_idx = %s")
                indices_params.append(data['investimento_idx'])
            if 'receita_idx' in data:
                indices_updates.append("receita_idx = %s")
                indices_params.append(data['receita_idx'])
            if 'roas_idx' in data:
                indices_updates.append("roas_idx = %s")
                indices_params.append(data['roas_idx'])
            if 'mc_idx' in data:
                indices_updates.append("mc_idx = %s")
                indices_params.append(data['mc_idx'])
                
            if indices_updates:

                cursor.execute("SELECT id FROM column_indices WHERE site_id = %s", (site_id,))
                if cursor.fetchone():
                    query_indices = f"UPDATE column_indices SET {', '.join(indices_updates)} WHERE site_id = %s"
                    indices_params.append(site_id)
                    cursor.execute(query_indices, tuple(indices_params))
                else:
                     pass 


            conn.commit()
            
            return cursor.rowcount > 0 or True # Retorna True mesmo se não houve mudança de valor, desde que SQL ok
            
        except Error as e:
            logging.error(f"Erro ao atualizar site {site_id}: {e}")
            return False
        finally:
            if conn:
                conn.close()
    
    def get_site_config(self, name: str) -> Dict[str, Any]:
        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return self.get_default_config()
                
            cursor = conn.cursor(dictionary=True)
            
            cursor.execute("""
            SELECT s.name, s.sheet_url, c.investimento_idx, c.receita_idx, c.roas_idx, c.mc_idx, ch.webhook_url, ch.name as squad_name, s.status
            FROM sites s
            JOIN column_indices c ON s.id = c.site_id
            LEFT JOIN slack_channels ch ON s.slack_channel_id = ch.id
            WHERE s.name = %s
            """, (name,))
            
            result = cursor.fetchone()
            cursor.close()
            
            if result:
                return {
                    "sheet_url": result["sheet_url"],
                    "indices": {
                        "investimento": result["investimento_idx"],
                        "receita": result["receita_idx"],
                        "roas": result["roas_idx"],
                        "mc": result["mc_idx"]
                    },
                    "slack_webhook_url": result["webhook_url"],
                    "squad_name": result.get("squad_name"),
                    "status": result["status"]
                }
            
            return self.get_default_config()
            
        except Error as e:
            logging.error(f"Erro ao buscar configuração do site: {e}")
            return self.get_default_config()
        finally:
            if conn:
                conn.close()
    
    def get_default_config(self) -> Dict[str, Any]:
        return {
            "sheet_url": "https://docs.google.com/spreadsheets/d/1tE7ZBhvsfUqcZNa4UnrrALrXOwRlc185a7iVPh_iv7g/edit?gid=1046712131",
            "indices": {
                "investimento": 7,  
                "receita": 8,     
                "roas": 12,       
                "mc": 16,       
            }
        }
    
    def get_all_sites(self) -> List[str]:
        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return []
                
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sites")
            results = cursor.fetchall()
            cursor.close()
            
            return [row[0] for row in results]
            
        except Error as e:
            logging.error(f"Erro ao listar sites: {e}")
            return []
        finally:
            if conn:
                conn.close()
    
    def delete_site(self, name: str) -> bool:
        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return False
                
            cursor = conn.cursor()
            
            cursor.execute("""
            DELETE FROM column_indices 
            WHERE site_id IN (SELECT id FROM sites WHERE name = %s)
            """, (name,))
            
            cursor.execute("DELETE FROM sites WHERE name = %s", (name,))
            conn.commit()
            
            affected_rows = cursor.rowcount
            cursor.close()
            return affected_rows > 0
            
        except Error as e:
            logging.error(f"Erro ao remover site: {e}")
            return False
        finally:
            if conn:
                conn.close()

    def delete_site_by_id(self, site_id: int) -> bool:
        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return False
                
            cursor = conn.cursor()
            

            cursor.execute("DELETE FROM column_indices WHERE site_id = %s", (site_id,))
            
            cursor.execute("DELETE FROM sites WHERE id = %s", (site_id,))
            conn.commit()
            
            affected_rows = cursor.rowcount
            cursor.close()
            return affected_rows > 0
            
        except Error as e:
            logging.error(f"Erro ao remover site {site_id}: {e}")
            return False
        finally:
            if conn:
                conn.close()
    
    def get_site_by_id(self, site_id: int) -> Optional[Dict[str, Any]]:
        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return None
                
            cursor = conn.cursor(dictionary=True)
            
            cursor.execute("""
            SELECT s.id, s.name, s.sheet_url, c.investimento_idx, c.receita_idx, c.roas_idx, c.mc_idx, ch.webhook_url, ch.name as squad_name, s.status
            FROM sites s
            JOIN column_indices c ON s.id = c.site_id
            LEFT JOIN slack_channels ch ON s.slack_channel_id = ch.id
            WHERE s.id = %s
            """, (site_id,))
            
            result = cursor.fetchone()
            cursor.close()
            
            if result:
                return {
                    "id": result["id"],
                    "name": result["name"],
                    "sheet_url": result["sheet_url"],
                    "indices": {
                        "investimento": result["investimento_idx"],
                        "receita": result["receita_idx"],
                        "roas": result["roas_idx"],
                        "mc": result["mc_idx"]
                    },
                    "slack_webhook_url": result["webhook_url"],
                    "squad_name": result.get("squad_name"),
                    "status": result["status"]
                }
            
            return None
            
        except Error as e:
            logging.error(f"Erro ao buscar site por ID: {e}")
            return None
        finally:
            if conn:
                conn.close()

    def update_squad_name(self, old_name: str, new_name: str) -> int:
        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return 0
                
            cursor = conn.cursor()
            

            try:
                cursor.execute("UPDATE slack_channels SET name = %s WHERE name = %s", (new_name, old_name))
                updated_count = cursor.rowcount
                if updated_count > 0:
                    conn.commit()
                    cursor.close()
                    return updated_count
            except Error:
                pass



            try:
                cursor.execute("UPDATE sites SET squad_name = %s WHERE squad_name = %s", (new_name, old_name))
                updated_count = cursor.rowcount
            except Error:
                updated_count = 0
            
            conn.commit()
            cursor.close()
            return updated_count
            
        except Error as e:
            logging.error(f"Erro ao atualizar squad: {e}")
            return 0
        finally:
            if conn:
                conn.close()

    def get_all_sites_detailed(self, name_filter: Optional[str] = None, squad_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return []
                
            cursor = conn.cursor(dictionary=True)
            
            query = """
            SELECT s.id, s.name, s.sheet_url, s.status, ch.name as squad_name, ch.webhook_url
            FROM sites s
            LEFT JOIN slack_channels ch ON s.slack_channel_id = ch.id
            WHERE 1=1
            """
            params = []
            
            if name_filter:
                query += " AND s.name LIKE %s"
                params.append(f"%{name_filter}%")
                
            if squad_filter:
                query += " AND ch.name = %s"
                params.append(squad_filter)
            
            query += " ORDER BY s.name"
            
            cursor.execute(query, tuple(params))
            
            results = cursor.fetchall()
            cursor.close()
            
            sites = []
            for row in results:
                sites.append({
                    "id": row["id"],
                    "name": row["name"],
                    "sheet_url": row["sheet_url"],
                    "squad_name": row["squad_name"],
                    "has_webhook": bool(row["webhook_url"]),
                    "status": row["status"] or "active"
                })
            
            return sites
            
        except Error as e:
            logging.error(f"Erro ao listar sites detalhados: {e}")
            return []
        finally:
            if conn:
                conn.close()

    def log_activity(self, site_name: str, status: str, message: str) -> bool:
        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return False
                
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO processing_logs (site_name, status, message)
            VALUES (%s, %s, %s)
            """, (site_name, status, message))
            
            conn.commit()
            cursor.close()
            return True
            
        except Error as e:
            logging.error(f"Erro ao registrar log de atividade: {e}")
            return False
        finally:
            if conn:
                conn.close()

    def get_recent_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        conn = None
        try:
            conn = self._get_connection()
            if not conn:
                return []
                
            cursor = conn.cursor(dictionary=True)
            cursor.execute("""
            SELECT id, site_name, status, message, created_at
            FROM processing_logs
            ORDER BY created_at DESC
            LIMIT %s
            """, (limit,))
            
            logs = cursor.fetchall()
            cursor.close()
            

            for log in logs:
                if log['created_at']:
                    log['created_at'] = log['created_at'].isoformat()
            
            return logs
            
        except Error as e:
            logging.error(f"Erro ao buscar logs recentes: {e}")
            return []
        finally:
            if conn:
                conn.close()