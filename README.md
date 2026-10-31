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

Security checks:

- Install `pre-commit` and `gitleaks`, then run `pre-commit install` to scan staged changes for secrets before each commit.
- Run `gitleaks git --log-opts='--all' --redact=100` to scan the complete local Git history. A zero-match result is limited to patterns Gitleaks recognizes.
- GitHub Actions runs Gitleaks, Trivy, and CodeQL on pull requests, pushes to `main`, and a weekly schedule. The review prompt is in [`.github/SECURITY_REVIEW.md`](.github/SECURITY_REVIEW.md).
- Dependabot is configured to propose weekly Python dependency and GitHub Actions updates. Repository Dependabot alerts and security updates are managed in GitHub settings.

`requirements.txt` contains version ranges and this repository has no lockfile or deployed dependency inventory. A zero-result Trivy filesystem scan therefore does not establish that the resolved deployment dependencies are free of known vulnerabilities.
