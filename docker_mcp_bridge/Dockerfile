FROM python:3.12-slim
RUN apt-get update && apt-get install -y docker.io curl && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir aiohttp
WORKDIR /app
COPY main.py .
CMD ["python", "main.py"]
