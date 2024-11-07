from celery import Celery

from core.config import settings


celery = Celery(__name__)
celery.conf.broker_url = settings.CELERY_BROKER_URL
celery.conf.result_backend = settings.CELERY_RESULT_BACKEND
celery.conf.broker_connection_retry_on_startup = True

celery.conf.beat_schedule = {
    'update_expired_messages': {
        'task': 'tasks.update_messages',
        'schedule': 10.0,
    },
}