import logging
from typing import Dict, Any, List
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

class SlackClient:
    
    def __init__(self, token: str, default_channel: str):
        self.client = WebClient(token=token)
        self.default_channel = default_channel
    
    def send_message(self, text: str, channel: str = None) -> bool:
        try:
            response = self.client.chat_postMessage(
                channel=channel or self.default_channel,
                text=text
            )
            return True
        except SlackApiError as e:
            logging.error(f"Erro ao enviar mensagem para o Slack: {e}")
            return False
    
    def send_record_as_message(self, record: Dict[str, Any], channel: str = None, 
                               template: str = None) -> bool:
        try:
            if not template:
                message_parts = []
                for key, value in record.items():
                    if value is not None:
                        message_parts.append(f"*{key}*: {value}")
                
                message = "\n".join(message_parts)
            else:
                message = template.format(**record)
            
            return self.send_message(message, channel)
            
        except Exception as e:
            logging.error(f"Erro ao formatar e enviar registro para o Slack: {e}")
            return False
            
    def send_batch(self, records: List[Dict[str, Any]], channel: str = None, 
                  template: str = None) -> int:
        success_count = 0
        for record in records:
            if self.send_record_as_message(record, channel, template):
                success_count += 1
        
        return success_count 
    
    def send_summary_message(self, site_name: str, roas: str, mc: str, 
                           channel: str = None) -> bool:
        try:
            message = f"*{site_name}*\n"
            message += f"ROAS: {roas}\n"
            message += f"MC: {mc}"
            
            return self.send_message(message, channel)
            
        except Exception as e:
            logging.error(f"Erro ao enviar resumo para o Slack: {e}")
            return False