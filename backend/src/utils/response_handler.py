from flask import jsonify

class ResponseHandler:
    @staticmethod
    def success(data=None, message="Operação realizada com sucesso", status_code=200):
        response = {
            'success': True,
            'message': message,
            'data': data
        }
        return jsonify(response), status_code

    @staticmethod
    def error(message="Erro interno do servidor", status_code=500, error_code=None):
        response = {
            'success': False,
            'message': message,
            'data': None,
            'error_code': error_code
        }
        return jsonify(response), status_code
