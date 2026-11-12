"""Email backend that delivers messages through Supabase."""
import logging
import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


class SupabaseEmailBackend(BaseEmailBackend):
    """
    Django email backend delivering transactional messages via a Supabase Edge Function.
    Requires settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY.
    """

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.supabase_url = getattr(settings, "SUPABASE_URL", "").rstrip("/")
        self.service_role_key = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "")
        self.function_name = getattr(settings, "SUPABASE_EMAIL_FUNCTION_NAME", "send-email")

    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        if not self.supabase_url or not self.service_role_key:
            msg = "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured to use SupabaseEmailBackend."
            if not self.fail_silently:
                raise RuntimeError(msg)
            logger.error(msg)
            return 0

        endpoint = f"{self.supabase_url}/functions/v1/{self.function_name}"
        headers = {
            "Authorization": f"Bearer {self.service_role_key}",
            "apikey": self.service_role_key,
            "Content-Type": "application/json",
        }

        sent = 0
        for message in email_messages:
            recipients = list(message.to)
            if not recipients:
                continue

            payload = {
                "to": recipients,
                "from": message.from_email or getattr(settings, "DEFAULT_FROM_EMAIL", ""),
                "subject": message.subject,
                "text": message.body,
            }

            for content, mime_type in getattr(message, "alternatives", []):
                if mime_type == "text/html":
                    payload["html"] = content
                    break

            try:
                response = requests.post(endpoint, json=payload, headers=headers, timeout=15)
                response.raise_for_status()
                sent += 1
            except Exception as exc:
                if not self.fail_silently:
                    raise exc
                logger.exception("Supabase email delivery failed for %s", recipients)

        return sent

