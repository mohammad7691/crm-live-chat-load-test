#!/bin/bash
# Load credentials from .env for JMeter runs (copy .env.example → .env first).
set -a
ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "Warning: no .env file found. Copy .env.example to .env and add credentials."
fi
set +a

# JMeter -J properties from env (used by crm_chat_full_jmeter*.jmx)
JMETER_CREDS_ARGS=(
  -Jagent_email="${AGENT_EMAIL:-}"
  -Jagent_password="${AGENT_PASSWORD:-}"
  -Jagent2_email="${AGENT2_EMAIL:-}"
  -Jagent2_password="${AGENT2_PASSWORD:-}"
  -Jwidget_public_key="${WIDGET_PUBLIC_KEY:-}"
  -Jwidget_site_id="${WIDGET_SITE_ID:-}"
  -Jcrm_api_host="${CRM_API_HOST:-api.crm.swagprinthub.com}"
  -Jvisitor_api_host="${VISITOR_API_HOST:-api.chat.crm.swagprinthub.com}"
  -Jvisitor_origin="${VISITOR_ORIGIN:-https://nst.staging.rev9solutions.com}"
)
