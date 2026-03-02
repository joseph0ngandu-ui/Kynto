FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN groupadd -g 10000 kynto_group && useradd -u 10000 -g kynto_group -s /bin/bash -m -d /home/kynto_agent kynto_agent

RUN mkdir -p /home/kynto_agent/sandbox && chown -R kynto_agent:kynto_group /home/kynto_agent/sandbox && chmod 700 /home/kynto_agent/sandbox
WORKDIR /home/kynto_agent/sandbox

# Install core utilities and security auditing toolkit
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    netcat-traditional \
    dnsutils \
    iputils-ping \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install required Python packages for the web service
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install openai requests aiohttp groq

COPY cli_wrapper.py .
USER kynto_agent

CMD ["python", "cli_wrapper.py"]
