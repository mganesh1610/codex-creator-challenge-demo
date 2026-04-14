# Codex Creator Challenge Demo

This repository is a sanitized public demo of the original workflow.

What is included:
- A public homepage with overview metrics and workflow entry points
- Patient onboarding backed by synthetic in-memory demo data
- A Dataloader flow that previews retained/shared uploads and simulates import
- An AI report page that queries the synthetic demo dataset
- A dashboard page that summarizes demo activity without private embeds

What is intentionally removed:
- Real credentials, secrets, API keys, and passwords
- Private database connections and schema-specific backend logic
- Private reporting embeds and organization-specific infrastructure
- Sensitive operational data

Local run:
```bash
python -m uvicorn app.main:app --reload
```
