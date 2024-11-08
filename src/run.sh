#!/bin/sh
python main.py &
celery -A tasks.celery worker -f log/celery.log -l warning &
celery -A tasks.celery beat -f log/celery.log -l warning