FROM python:3.11

# Создаём непривилегированного пользователя
RUN useradd -m -u 1000 -s /bin/bash celeryuser

WORKDIR /app

EXPOSE 8000

COPY ./requirements.txt /app

RUN pip install --upgrade pip && pip install -r requirements.txt --no-cache-dir

COPY ./src/ /app
COPY ./pytest.ini /app

# Создаём директорию для логов и даём права пользователю
RUN mkdir -p /app/log && chown -R celeryuser:celeryuser /app

# Переключаемся на непривилегированного пользователя
USER celeryuser