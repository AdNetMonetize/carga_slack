import os
import sys
import logging
import traceback
import secrets
import string
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv


logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('api_debug.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)


sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

load_dotenv()
logger.info("Environment variables loaded")

try:
    from db_manager import DBManager
    from auth_manager import AuthManager
    from utils.response_handler import ResponseHandler
    logger.info("All modules imported successfully")
except Exception as e:
    logger.error(f"Error importing modules: {e}")
    logger.error(traceback.format_exc())
    raise

app = Flask(__name__)
CORS(app, origins='*', supports_credentials=True)
logger.info("Flask app created")


app.config['JSON_SORT_KEYS'] = False


@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"❌ Unhandled exception: {e}")
    logger.error(traceback.format_exc())
    return ResponseHandler.error(f"Internal server error: {str(e)}", 500)


@app.before_request
def log_request():
    logger.info(f"📥 {request.method} {request.path} from {request.remote_addr}")
    if request.get_json(silent=True):
        logger.debug(f"Request body: {request.get_json()}")

@app.after_request
def log_response(response):
    logger.info(f"📤 Response: {response.status_code}")
    return response


try:
    logger.info("Initializing DBManager...")
    db = DBManager()
    db.connect()
    logger.info("DBManager connected successfully")
    
    logger.info("Initializing AuthManager...")
    auth = AuthManager(db)
    logger.info("AuthManager initialized successfully")
except Exception as e:
    logger.error(f"Error initializing managers: {e}")
    logger.error(traceback.format_exc())
    raise


def token_required(f):

    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return ResponseHandler.error('Token não fornecido', 401, 'MISSING_TOKEN')
        
        user = auth.verify_request(token)
        if not user:
            return ResponseHandler.error('Token inválido ou expirado', 401, 'INVALID_TOKEN')
        
        request.user = user
        return f(*args, **kwargs)
    
    return decorated


from main import run_batch_processing
import threading

@app.route('/api/process/manual', methods=['POST'])
@token_required
def manual_process():

    try:

        thread = threading.Thread(target=run_batch_processing)
        thread.start()
        
        return ResponseHandler.success({'message': 'Processamento manual iniciado com sucesso.'})
    except Exception as e:
        return ResponseHandler.error(str(e))



@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return ResponseHandler.error('Username e password são obrigatórios', 400)
    
    result = auth.login(data['username'], data['password'], data.get('remember', False))
    
    if not result:
        return ResponseHandler.error('Credenciais inválidas', 401, 'INVALID_CREDENTIALS')
    
    return ResponseHandler.success(result, 'Login realizado com sucesso')


@app.route('/api/auth/verify', methods=['GET'])
@token_required
def verify_token():
    return ResponseHandler.success({'valid': True, 'user': request.user}, 'Token válido')


@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user():
    return ResponseHandler.success(request.user)


@app.route('/api/auth/change-password', methods=['POST'])
@token_required
def change_password():
    data = request.get_json()
    new_password = data.get('new_password')
    
    if not new_password or len(new_password) < 6:
        return ResponseHandler.error('Senha deve ter no mínimo 6 caracteres', 400)
        
    success = auth.change_password(request.user['user_id'], new_password)
    
    if success:
        return ResponseHandler.success(None, 'Senha alterada com sucesso')
    else:
        return ResponseHandler.error('Erro ao alterar senha', 500)




@app.route('/api/sites', methods=['GET'])
@token_required
def get_sites():
    try:
        name_filter = request.args.get('name')
        squad_filter = request.args.get('squad')
        
        sites_data = db.get_all_sites_detailed(name_filter, squad_filter)
        return ResponseHandler.success({'sites': sites_data, 'total': len(sites_data)})
        
    except Exception as e:
        return ResponseHandler.error(str(e))


@app.route('/api/sites/<name>', methods=['GET'])
@token_required
def get_site(name):
    try:
        config = db.get_site_config(name)
        
        if not config.get('sheet_url'):
            return ResponseHandler.error('Site não encontrado', 404)
        
        return ResponseHandler.success({
            'name': name,
            'sheet_url': config.get('sheet_url'),
            'indices': config.get('indices'),
            'squad_name': config.get('squad_name'),
            'has_webhook': bool(config.get('slack_webhook_url'))
        })
        
    except Exception as e:
        return ResponseHandler.error(str(e))


@app.route('/api/sites', methods=['POST'])
@token_required
def create_site():
    if request.user.get('role') != 'admin':
        return ResponseHandler.error('Acesso negado', 403)
    
    data = request.get_json()
    
    required = ['name', 'sheet_url', 'investimento_idx', 'receita_idx', 'roas_idx', 'mc_idx']
    for field in required:
        if field not in data:
            return ResponseHandler.error(f'Campo {field} é obrigatório', 400)
    
    try:
        success = db.add_site(
            data['name'],
            data['sheet_url'],
            data.get('investimento_idx', 0),
            data.get('receita_idx', 0),
            data.get('roas_idx', 0),
            data.get('mc_idx', 0),
            data.get('squad_name'),
            data.get('status', 'active')
        )
        
        if success:
            return ResponseHandler.success(None, 'Site criado com sucesso', 201)
        else:
            return ResponseHandler.error('Erro ao criar site', 500)
            
    except Exception as e:
        return ResponseHandler.error(str(e))


@app.route('/api/sites/<int:site_id>', methods=['GET'])
@token_required
def get_site_by_id(site_id):
    try:
        site = db.get_site_by_id(site_id)
        
        if not site:
            return ResponseHandler.error('Site não encontrado', 404)
        
        response_data = site.copy()
        if 'indices' in site:
            indices = site['indices']
            response_data['investimento_idx'] = indices.get('investimento', 0)
            response_data['receita_idx'] = indices.get('receita', 0)
            response_data['roas_idx'] = indices.get('roas', 0)
            response_data['mc_idx'] = indices.get('mc', 0)
            del response_data['indices']
            
        return ResponseHandler.success(response_data)
        
    except Exception as e:
        return ResponseHandler.error(str(e))


@app.route('/api/sites/<int:site_id>', methods=['PUT'])
@token_required
def update_site_by_id(site_id):
    if request.user.get('role') != 'admin':
        return ResponseHandler.error('Acesso negado', 403)
    
    try:
        data = request.get_json()
        success = db.update_site(site_id, data)
        
        if success:
            updated_site = db.get_site_by_id(site_id)
            return ResponseHandler.success(updated_site, 'Site atualizado com sucesso')
        else:
            return ResponseHandler.error('Site não encontrado ou erro ao atualizar', 404)
            
    except Exception as e:
        return ResponseHandler.error(str(e))


@app.route('/api/sites/<int:site_id>', methods=['DELETE'])
@token_required
def delete_site_by_id(site_id):
    if request.user.get('role') != 'admin':
        return ResponseHandler.error('Acesso negado', 403)
    
    try:
        success = db.delete_site_by_id(site_id)
        
        if success:
            return ResponseHandler.success(None, 'Site removido com sucesso')
        else:
            return ResponseHandler.error('Site não encontrado ou erro ao remover', 404)
            
    except Exception as e:
        return ResponseHandler.error(str(e))


@app.route('/api/sites/<name>', methods=['DELETE'])
@token_required
def delete_site(name):
    if request.user.get('role') != 'admin':
        return ResponseHandler.error('Acesso negado', 403)
    
    try:
        success = db.delete_site(name)
        
        if success:
            return ResponseHandler.success(None, 'Site removido com sucesso')
        else:
            return ResponseHandler.error('Site não encontrado', 404)
            
    except Exception as e:
        return ResponseHandler.error(str(e))




@app.route('/api/sheets/headers', methods=['POST'])
@token_required
def get_sheet_headers():
    try:
        data = request.get_json()
        sheet_url = data.get('sheet_url')
        
        if not sheet_url:
            return ResponseHandler.error('URL da planilha é obrigatória', 400)
        
        import gspread
        from google.oauth2.service_account import Credentials
        
        SCOPES = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]
        
        creds_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'google_service_account.json')
        
        creds = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
        gc = gspread.authorize(creds)
        spreadsheet = gc.open_by_url(sheet_url)
        
        worksheets = spreadsheet.worksheets()
        sheets_info = []
        
        for ws in worksheets:
            sheets_info.append({
                'id': ws.id,
                'name': ws.title
            })
        
        first_sheet = worksheets[0]
        all_data = first_sheet.get_all_values()
        
        header_row_index = 0
        for i, row in enumerate(all_data):
            if row and ('Data' in row or row[0] == 'Data'):
                header_row_index = i
                break
        
        headers = all_data[header_row_index] if header_row_index < len(all_data) else []
        
        headers_with_index = []
        for i, header in enumerate(headers):
            if header and header.strip():
                headers_with_index.append({
                    'index': i,
                    'name': header.strip()
                })
        
        return ResponseHandler.success({
            'sheets': sheets_info,
            'headers': headers_with_index,
            'total_columns': len(headers)
        })
        
    except Exception as e:
        return ResponseHandler.error(f'Erro ao ler planilha: {str(e)}')


@app.route('/api/sheets/headers/<sheet_name>', methods=['POST'])
@token_required
def get_sheet_headers_by_name(sheet_name):
    try:
        data = request.get_json()
        sheet_url = data.get('sheet_url')
        
        if not sheet_url:
            return ResponseHandler.error('URL da planilha é obrigatória', 400)
        
        import gspread
        from google.oauth2.service_account import Credentials
        
        SCOPES = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]
        
        creds_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'google_service_account.json')
        creds = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
        gc = gspread.authorize(creds)
        spreadsheet = gc.open_by_url(sheet_url)
        
        target_sheet = None
        for ws in spreadsheet.worksheets():
            if ws.title == sheet_name:
                target_sheet = ws
                break
        
        if not target_sheet:
            return ResponseHandler.error(f'Aba "{sheet_name}" não encontrada', 404)
        
        all_data = target_sheet.get_all_values()
        
        header_row_index = 0
        for i, row in enumerate(all_data):
            if row and ('Data' in row or row[0] == 'Data'):
                header_row_index = i
                break
        
        headers = all_data[header_row_index] if header_row_index < len(all_data) else []
        
        headers_with_index = []
        for i, header in enumerate(headers):
            if header and header.strip():
                headers_with_index.append({
                    'index': i,
                    'name': header.strip()
                })
        
        return ResponseHandler.success({
            'sheet_name': sheet_name,
            'headers': headers_with_index,
            'total_columns': len(headers)
        })
        
    except Exception as e:
        return ResponseHandler.error(f'Erro ao ler aba: {str(e)}')




@app.route('/api/users', methods=['GET'])
@token_required
def get_users():
    if request.user.get('role') != 'admin':
        return ResponseHandler.error('Acesso negado', 403)
    
    users = auth.get_all_users()
    return ResponseHandler.success({'users': users, 'total': len(users)})


@app.route('/api/users', methods=['POST'])
@token_required
def create_user():
    if request.user.get('role') != 'admin':
        return ResponseHandler.error('Acesso negado', 403)
    
    data = request.get_json()
    
    if 'email' not in data:
        return ResponseHandler.error('Campo email é obrigatório', 400)
    
    email = data['email']
    username = data.get('username') or email 
    role = data.get('role', 'viewer')
    
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(chars) for _ in range(12))
    
    success = auth.create_user(
        username,
        email,
        password,
        role,
        must_change_password=True
    )
    
    if success:
        return ResponseHandler.success({'password': password}, 'Usuário criado com sucesso', 201)
    else:
        return ResponseHandler.error('Erro ao criar usuário. Email ou usuário já existem?', 500)


@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@token_required
def delete_user(user_id):
    if request.user.get('role') != 'admin':
        return ResponseHandler.error('Acesso negado', 403)
        
    try:
        success = auth.delete_user(user_id)
        if success:
            return ResponseHandler.success(None, 'Usuário removido com sucesso')
        return ResponseHandler.error('Usuário não encontrado ou erro ao remover', 404)
    except Exception as e:
        return ResponseHandler.error(str(e))


@app.route('/api/users/<int:user_id>', methods=['PUT'])
@token_required
def update_user(user_id):
    if request.user.get('role') != 'admin':
        return ResponseHandler.error('Acesso negado', 403)
        
    data = request.get_json()
    try:
        success = auth.update_user(user_id, data)
        if success:
             updated_user = auth.get_user_by_id(user_id)
             return ResponseHandler.success(updated_user, 'Usuário atualizado com sucesso')
        return ResponseHandler.error('Erro ao atualizar usuário', 500)
    except Exception as e:
        return ResponseHandler.error(str(e))




@app.route('/api/sites/test/<name>', methods=['GET'])
@token_required
def test_site_mapping(name):
    try:
        sheet_index = request.args.get('sheet', 0, type=int)
        
        config = db.get_site_config(name)
        if not config:
            return ResponseHandler.error('Site não encontrado', 404)
        
        sheet_url = config.get('sheet_url')
        if not sheet_url:
            return ResponseHandler.error('Site sem URL de planilha configurada', 400)
        
        import gspread
        from google.oauth2.service_account import Credentials
        
        SCOPES = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]
        
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        creds_path = os.path.join(project_root, 'google_service_account.json')
        
        creds = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
        gc = gspread.authorize(creds)
        spreadsheet = gc.open_by_url(sheet_url)
        
        worksheet = spreadsheet.get_worksheet(sheet_index)
        if not worksheet:
            worksheet = spreadsheet.get_worksheet(0)
        
        all_data = worksheet.get_all_values()
        
        if len(all_data) < 2:
            return ResponseHandler.error('Planilha vazia ou sem dados', 400)
        
        header_row_index = 0
        for i, row in enumerate(all_data):
            if row and ('Data' in row or row[0] == 'Data'):
                header_row_index = i
                break
        
        headers = all_data[header_row_index] if header_row_index < len(all_data) else []
        
        last_data_row = all_data[-1] if len(all_data) > header_row_index + 1 else []
        
        indices = config.get('indices', {})
        
        metrics = [
            {'metric': 'Investimento', 'key': 'investimento'},
            {'metric': 'Receita', 'key': 'receita'},
            {'metric': 'ROAS', 'key': 'roas'},
            {'metric': 'MC', 'key': 'mc'}
        ]
        
        results = []
        for m in metrics:
            idx = indices.get(m['key'], 0) if indices else 0
            header_name = headers[idx] if idx < len(headers) else f'Coluna {idx}'
            value = last_data_row[idx] if idx < len(last_data_row) else 'N/A'
            
            results.append({
                'metric': m['metric'],
                'column_name': header_name,
                'index': idx,
                'value': value
            })
        
        return ResponseHandler.success({
            'site': name,
            'total_rows': len(all_data) - header_row_index - 1,
            'last_row': len(all_data),
            'results': results
        })
        
    except Exception as e:
        return ResponseHandler.error(f'Erro ao testar mapeamento: {str(e)}')




@app.route('/api/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats():
    try:
        sites = db.get_all_sites()
        users = auth.get_all_users()
        
        return ResponseHandler.success({
            'total_sites': len(sites),
            'total_users': len(users),
            'sites_with_data': len(sites),
            'last_update': None
        })
        
    except Exception as e:
        return ResponseHandler.error(str(e))

@app.route('/api/dashboard/logs', methods=['GET'])
@token_required
def get_dashboard_logs():
    try:
        limit = request.args.get('limit', 50, type=int)
        logs = db.get_recent_logs(limit)
        return ResponseHandler.success({'logs': logs})
        
    except Exception as e:
        return ResponseHandler.error(str(e))



@app.route('/api/squads', methods=['GET'])
@token_required
def get_squads():
    try:
        conn = db._get_connection()
        if not conn:
            return ResponseHandler.error('Erro ao conectar ao banco de dados', 500)
        
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                sc.name,
                sc.webhook_url,
                COUNT(s.id) as sites_count
            FROM slack_channels sc
            LEFT JOIN sites s ON s.slack_channel_id = sc.id
            GROUP BY sc.id, sc.name, sc.webhook_url
            ORDER BY sc.name
        """)
        
        squads_data = cursor.fetchall()
        cursor.close()
        conn.close()
        
        squads = []
        for squad in squads_data:
            squads.append({
                'name': squad['name'],
                'sites_count': squad['sites_count'],
                'webhook_url': squad['webhook_url'],
                'sites': []
            })
        
        return ResponseHandler.success({'squads': squads, 'total': len(squads)})
        
    except Exception as e:
        return ResponseHandler.error(str(e))


@app.route('/api/squads', methods=['POST'])
@token_required
def create_squad():
    if request.user.get('role') != 'admin':
        return ResponseHandler.error('Acesso negado', 403)
    
    data = request.get_json()
    squad_name = data.get('name', '').strip()
    webhook_url = data.get('webhook_url', '').strip() or None
    
    if not squad_name:
        return ResponseHandler.error('Nome do squad é obrigatório', 400)
    
    try:
        conn = db._get_connection()
        if not conn:
            return ResponseHandler.error('Erro ao conectar ao banco de dados', 500)
        
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT MAX(id) as max_id FROM slack_channels")
        result = cursor.fetchone()
        next_id = (result['max_id'] or 0) + 1
        
        cursor.execute("""
            INSERT INTO slack_channels (id, name, webhook_url)
            VALUES (%s, %s, %s)
        """, (next_id, squad_name, webhook_url))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return ResponseHandler.success(None, 'Squad criado com sucesso', 201)
        
    except Exception as e:
        logger.error(f"Erro ao criar squad: {e}")
        if 'Duplicate entry' in str(e) or 'duplicate key' in str(e).lower():
            return ResponseHandler.error('Já existe um squad com este nome', 400)
        return ResponseHandler.error(str(e))



@app.route('/api/squads/<name>', methods=['PUT'])
@token_required
def update_squad(name):
    if request.user.get('role') != 'admin':
        return ResponseHandler.error('Acesso negado', 403)
    
    data = request.get_json()
    new_name = data.get('new_name', '').strip()
    webhook_url = data.get('webhook_url', '').strip() or None
    
    if not new_name:
        return ResponseHandler.error('Novo nome é obrigatório', 400)
    
    try:
        conn = db._get_connection()
        if not conn:
            return ResponseHandler.error('Erro ao conectar ao banco de dados', 500)
        
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE slack_channels
            SET name = %s, webhook_url = %s
            WHERE name = %s
        """, (new_name, webhook_url, name))
        
        conn.commit()
        updated = cursor.rowcount > 0
        cursor.close()
        conn.close()
        
        if updated:
            return ResponseHandler.success(None, 'Squad atualizado com sucesso')
        else:
            return ResponseHandler.error('Squad não encontrado', 404)
        
    except Exception as e:
        logger.error(f"Erro ao atualizar squad: {e}")
        if 'Duplicate entry' in str(e) or 'duplicate key' in str(e).lower():
            return ResponseHandler.error('Já existe um squad com este nome', 400)
        return ResponseHandler.error(str(e))


@app.route('/api/squads/<name>', methods=['DELETE'])
@token_required
def delete_squad(name):
    if request.user.get('role') != 'admin':
        return ResponseHandler.error('Acesso negado', 403)
    
    try:
        conn = db._get_connection()
        if not conn:
            return ResponseHandler.error('Erro ao conectar ao banco de dados', 500)
        
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM sites s
            JOIN slack_channels sc ON s.slack_channel_id = sc.id
            WHERE sc.name = %s
        """, (name,))
        
        result = cursor.fetchone()
        if result and result['count'] > 0:
            cursor.close()
            conn.close()
            return ResponseHandler.error(f'Não é possível excluir. Existem {result["count"]} site(s) associado(s).', 400)
        
        cursor.execute("DELETE FROM slack_channels WHERE name = %s", (name,))
        conn.commit()
        
        deleted = cursor.rowcount > 0
        cursor.close()
        conn.close()
        
        if deleted:
            return ResponseHandler.success(None, 'Squad removido com sucesso')
        else:
            return ResponseHandler.error('Squad não encontrado', 404)
        
    except Exception as e:
        logger.error(f"Erro ao deletar squad: {e}")
        return ResponseHandler.error(str(e))




@app.route('/api/health', methods=['GET'])
def health_check():
    return ResponseHandler.success({
        'status': 'ok',
        'database': db.connection.is_connected() if db.connection else False
    })


if __name__ == '__main__':
    import signal
    import atexit
    
    def signal_handler(signum, frame):
        sig_name = signal.Signals(signum).name
        logger.warning(f"⚠️ Received signal {sig_name} ({signum})")
        logger.warning(f"Frame: {frame}")
        sys.exit(0)
    
    def on_exit():
        logger.warning("🛑 Server is shutting down (atexit called)")
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    if hasattr(signal, 'SIGBREAK'):
        signal.signal(signal.SIGBREAK, signal_handler)
    
    atexit.register(on_exit)
    
    host = os.getenv('API_HOST', '0.0.0.0')
    port = int(os.getenv('API_PORT', 5000))
    
    logger.info(f"🚀 API iniciando em http://{host}:{port}")
    print(f"🚀 API iniciando em http://{host}:{port}")
    
    try:
        from waitress import serve
        logger.info("Using waitress server (production-ready)")
        print("Using waitress server (production-ready)")
        serve(app, host=host, port=port, threads=4)
    except ImportError:
        logger.warning("Waitress not installed, falling back to Flask dev server")
        app.run(host=host, port=port, debug=False, use_reloader=False, threaded=True)
    except Exception as e:
        logger.error(f"❌ Server crashed with exception: {e}")
        logger.error(traceback.format_exc())
    finally:
        logger.warning("Server run() method exited")


