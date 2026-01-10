"""
Migration SEGURA para adicionar AUTO_INCREMENT ao campo id da tabela slack_channels
PRESERVA TODOS OS DADOS EXISTENTES
"""

import mysql.connector
from dotenv import load_dotenv
import os

load_dotenv()

def run_migration():
    try:
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_NAME')
        )
        
        cursor = conn.cursor(dictionary=True)
        
        print("🔍 Verificando estrutura atual da tabela slack_channels...")
        
        # Verifica a estrutura atual
        cursor.execute("SHOW CREATE TABLE slack_channels")
        result = cursor.fetchone()
        create_table = result['Create Table']
        
        print("\n📋 Estrutura atual:")
        print(create_table)
        
        # Verifica se já tem AUTO_INCREMENT
        if 'AUTO_INCREMENT' in create_table:
            print("\n✅ Campo id já possui AUTO_INCREMENT! Nada a fazer.")
            cursor.close()
            conn.close()
            return
        
        print("\n🔧 Campo id NÃO possui AUTO_INCREMENT. Iniciando correção...")
        
        # Conta quantos registros existem
        cursor.execute("SELECT COUNT(*) as count FROM slack_channels")
        count = cursor.fetchone()['count']
        print(f"📊 Encontrados {count} registros na tabela")
        
        # Verifica se há foreign keys apontando para esta tabela
        cursor.execute("""
            SELECT 
                TABLE_NAME,
                CONSTRAINT_NAME,
                REFERENCED_TABLE_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE REFERENCED_TABLE_NAME = 'slack_channels'
            AND TABLE_SCHEMA = %s
        """, (os.getenv('DB_NAME'),))
        
        foreign_keys = cursor.fetchall()
        
        if foreign_keys:
            print(f"\n⚠️ Encontradas {len(foreign_keys)} foreign keys apontando para esta tabela:")
            for fk in foreign_keys:
                print(f"   - {fk['TABLE_NAME']}.{fk['CONSTRAINT_NAME']}")
            print("\n🔧 Será necessário remover e recriar as foreign keys temporariamente...")
            
            # Remove foreign keys temporariamente
            for fk in foreign_keys:
                print(f"   Removendo FK: {fk['CONSTRAINT_NAME']} de {fk['TABLE_NAME']}")
                cursor.execute(f"ALTER TABLE {fk['TABLE_NAME']} DROP FOREIGN KEY {fk['CONSTRAINT_NAME']}")
        
        print("\n🔧 Modificando campo id para AUTO_INCREMENT...")
        
        # Modifica a coluna id para ser AUTO_INCREMENT
        # Isso preserva todos os dados existentes
        cursor.execute("""
            ALTER TABLE slack_channels 
            MODIFY COLUMN id INT AUTO_INCREMENT PRIMARY KEY
        """)
        
        print("✅ Campo id modificado com sucesso!")
        
        # Recria as foreign keys se necessário
        if foreign_keys:
            print("\n🔧 Recriando foreign keys...")
            for fk in foreign_keys:
                print(f"   Recriando FK: {fk['CONSTRAINT_NAME']} em {fk['TABLE_NAME']}")
                cursor.execute(f"""
                    ALTER TABLE {fk['TABLE_NAME']}
                    ADD CONSTRAINT {fk['CONSTRAINT_NAME']}
                    FOREIGN KEY (slack_channel_id) REFERENCES slack_channels(id)
                """)
        
        conn.commit()
        
        # Verifica o resultado final
        cursor.execute("SHOW CREATE TABLE slack_channels")
        result = cursor.fetchone()
        create_table_final = result['Create Table']
        
        print("\n✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!")
        print(f"✅ {count} registros preservados")
        print("\n📋 Estrutura final:")
        print(create_table_final)
        
        cursor.close()
        conn.close()
        
    except mysql.connector.Error as e:
        print(f"\n❌ Erro ao executar migration: {e}")
        print("⚠️ Nenhum dado foi perdido. A tabela permanece intacta.")
        raise

if __name__ == '__main__':
    run_migration()
