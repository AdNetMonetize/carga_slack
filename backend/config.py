import os
from dotenv import load_dotenv

load_dotenv()

# Slack Configuration
SLACK_BOT_TOKEN = os.getenv('SLACK_BOT_TOKEN', 'seu_token_slack_aqui')
SLACK_CHANNEL = os.getenv('SLACK_CHANNEL', 'seu_canal_slack_aqui')

# Google Sheets Configuration
GOOGLE_SHEETS_URL = os.getenv('GOOGLE_SHEETS_URL', 'https://docs.google.com/spreadsheets/d/1tE7ZBhvsfUqcZNa4UnrrALrXOwRlc185a7iVPh_iv7g/edit?gid=1046712131')

# File paths
PROCESSED_DATA_FILE = 'data/processed_records.json'
LOG_FILE = 'logs/excel_to_slack.log'

# API Configuration
API_HOST = os.getenv('API_HOST', '0.0.0.0')
API_PORT = int(os.getenv('API_PORT', 5000))
API_DEBUG = os.getenv('API_DEBUG', 'false').lower() == 'true' 