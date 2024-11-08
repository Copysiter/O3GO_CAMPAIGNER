#!/bin/sh
python main.py &
celery -A tasks.celery worker -f log/celery.log -l info &
celery -A tasks.celery beat -f log/celery.log -l info