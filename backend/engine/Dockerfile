FROM python:3.11-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.0 /uv /uvx /bin/

# Install mariadb/mysql client dependencies if needed
RUN apt-get update && apt-get install -y default-libmysqlclient-dev build-essential

WORKDIR /app
# Pevné verze knihoven (requirements.txt) - nová instalace musí dostat stejné, se kterými to funguje
COPY requirements.txt .
RUN uv pip install --system -r requirements.txt

COPY app/ ./app/
COPY scripts/ ./scripts/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
