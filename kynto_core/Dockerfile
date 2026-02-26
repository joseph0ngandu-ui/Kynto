FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN groupadd -g 10000 kynto_group && useradd -u 10000 -g kynto_group -s /bin/bash -m -d /home/kynto_agent kynto_agent

RUN mkdir -p /home/kynto_agent/sandbox && chown -R kynto_agent:kynto_group /home/kynto_agent/sandbox && chmod 700 /home/kynto_agent/sandbox
WORKDIR /home/kynto_agent/sandbox

# Install required Python packages for the web service
RUN pip install --no-cache-dir openai requests aiohttp

COPY cli_wrapper.py .
USER kynto_agent

CMD ["python", "cli_wrapper.py"]
