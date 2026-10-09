FROM python:3.11-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install mariadb/mysql client dependencies if needed
RUN apt-get update && apt-get install -y default-libmysqlclient-dev build-essential

WORKDIR /app
COPY pyproject.toml .
RUN uv pip install --system -r pyproject.toml

COPY app/ ./app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
