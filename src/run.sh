#!/bin/sh
set -e

# 1. Экспортируем переменную окружения
export CELERY_CUSTOM_WORKER_POOL="celery_aio_pool.pool:AsyncIOPool"

# 2. Запускаем приложение
python main.py &

# 3. Запускаем worker на фоне
celery -A tasks.celery worker \
       --pool=custom \
       --concurrency=100 \
       --loglevel=info \
       --logfile=log/celery.log &

# 4. Запускаем beat (пул ему не нужен) на переднем плане
celery -A tasks.celery beat \
       --loglevel=info \
       --logfile=log/celery.log