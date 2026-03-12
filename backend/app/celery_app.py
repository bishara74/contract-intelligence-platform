"""Celery application configuration."""

from celery import Celery

from app.config import settings

celery_app = Celery("contract_intel")

celery_app.conf.update(
    broker_url=settings.redis_url,
    result_backend=settings.redis_url,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_acks_late=True,
)

celery_app.conf.include = ["app.tasks.contract_tasks"]
