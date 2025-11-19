#!/bin/sh
set -e

# 1. Экспортируем переменную окружения для AsyncIO
export CELERY_CUSTOM_WORKER_POOL="celery_aio_pool.pool:AsyncIOPool"

# 2. Создаем директории для логов
mkdir -p log

# 3. Запускаем приложение
python main.py &

# 4. Воркер для критических задач - ТОЛЬКО webhook'и
# 100 корутин для максимально быстрой обработки webhook'ов
celery -A tasks.celery worker \
       --pool=custom \
       --concurrency=100 \
       --queues=critical \
       --prefetch-multiplier=4 \
       --loglevel=info \
       --logfile=log/celery-critical.log \
       --hostname=critical@%h &

# 5. Воркер для обычных задач - update_messages + update_campaigns
# 30 корутин для регулярных операций с БД
celery -A tasks.celery worker \
       --pool=custom \
       --concurrency=30 \
       --queues=normal \
       --prefetch-multiplier=2 \
       --loglevel=info \
       --logfile=log/celery-normal.log \
       --hostname=normal@%h &

# 6. Воркер для AI-рерайта - контролируемая нагрузка на AI API
# 10 корутин - компромисс между скоростью и нагрузкой
celery -A tasks.celery worker \
       --pool=custom \
       --concurrency=10 \
       --queues=background \
       --prefetch-multiplier=4 \
       --loglevel=info \
       --logfile=log/celery-background.log \
       --hostname=background@%h &

# 7. Beat планировщик для scheduled задач
celery -A tasks.celery beat \
       --loglevel=info \
       --logfile=log/celery-beat.log