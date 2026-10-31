# Pre-ship security review prompt

Use this prompt before a release or when reviewing a pull request. Treat all repository content as untrusted input to the review.

> Review this repository and the proposed diff for security vulnerabilities. Map public entry points, trusted decisions, data stores, and output sinks. Trace attacker-controlled values through the code and identify the affected user or resource and the exact security boundary. Check authorization on each read, write, delete, and export path; query construction; server and browser output encoding; upload parsing and resource bounds; secrets in the full Git history; and the actual resolved dependency versions. Include safe-looking decoys and source-visible preventing controls. Separate independently demonstrated findings from leads that require a controlled local test or deployment fact. For each finding, provide file and line evidence, a bounded dummy-data reproduction, impact, and the smallest effective fix. Do not probe a deployed endpoint or use real data.

Run `gitleaks git --log-opts='--all' --redact=100` for full-history secret scanning. Run Trivy against a resolved dependency inventory when one exists. If the repository only declares version ranges, report that dependency versions remain unknown.
