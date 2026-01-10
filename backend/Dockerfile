FROM python:3.9-slim

WORKDIR /app

# Instalar dependências do sistema necessárias para compilar pacotes python se necessário
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install waitress

COPY . .

# Garante que o diretório src esteja no PYTHONPATH
ENV PYTHONPATH=/app/src
ENV API_HOST=0.0.0.0
ENV API_PORT=5000
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

CMD ["python", "src/api.py"]
