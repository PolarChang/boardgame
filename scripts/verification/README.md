# Verification CI

The core workflow verifies recommendations and the existing application. The separate browser workflow adds the knowledge reader/management application slice and an immutable, public, model-free backend fixture. Other ongoing application and model work is excluded.

- `npm test`, `npm run lint`, `npm run build`: existing application and verifier checks.
- `npm run verify:properties`: 1,000 generated recommendation bucket cases; seed defaults to 20261119, failed cases shrink with fast-check.
- `npm run verify:differential`: 2,000 identical generated inputs against `VERIFICATION_BASE` (default HEAD), preserving all output order and fields; negative control catches a dropped bucket. Results include commit, hashes, seed and shrunk counterexample in tmp/verification/differential.
- `npm run verify:observe`: requires VERIFICATION_OBSERVE_INPUT with immutable base/candidate SHA and changed files; reads rules with git show from base, never a candidate/working-tree fallback. Tests replay a candidate deleting all rules in a temporary Git repository.

Both candidate workflows check out the exact PR head with read-only permissions and no persisted credentials or repository secrets. Core and browser results are separate. Failed and missing steps remain visible; no required status check or branch protection is configured here.

## Browser and isolated real integration

- `npm run verify`: six F01/F04 browser cases on desktop and narrow viewports against synthetic HTTP fixtures. These are mocked backend tests.
- `npm run verify:calibrate`: desktop valid control plus time-filter and source-link defects; the expected case and assertion must catch each defect.
- `npm run verify:integration`: four F05 browser cases through real Next.js routes, FastAPI and new SQLite. Covers rejected login, unpublished edits, persisted publication reread by a new reader, stale-version rejection, source authorization and session revocation.
- `npm run verify:integration:calibrate`: valid controls plus isolated anonymous-source leakage and false-success publication defects. Ordinary startup failures do not count as detection.
- `npm run verify:pdf`: two actual Chromium PDF viewer cases using a generated three-page PDF. Desktop checks native page/zoom; narrow view uses the site's page control and new-tab PDF link. This does not evaluate a real game's source or answer quality.
- `npm run verify:properties`: manuscript parsing, page-link and recommendation properties, plus recommendation bucket properties (1,000 generated inputs per property).

Install frontend dependencies with `npm ci`, then `npx playwright install chromium`. For integration/PDF, check out the repository and commit in `backend-lock.json`, install `tests/rule_knowledge/requirements-ci.txt` in an isolated Python environment, set `KNOWLEDGE_BACKEND_DIR` to that checkout and `KNOWLEDGE_PYTHON` to its absolute Python executable. Never point the fixture at production data. The launcher creates a fresh database and disables model dispatch; it rejects model/inventory mode overrides. Ports 3026 (fixture), 3027/8027 (real integration) must be free.

Reports, traces and version hashes are under `tmp/verification/`; integration and PDF have separate subdirectories. Calibration summaries distinguish valid controls from intentionally failing defect runs. Tests must run sequentially when sharing ports. The CI browser report binds outcomes to frontend HEAD and the backend lock commit; artifacts are candidate-produced, untrusted evidence. Model answer quality, inventory controls and real Hegemony page replay remain NOT_RUN.

The two manuscript files under `docs/knowledge-drafts` are parser regression inputs, preserving the 213-block manuscript contract. They are not original rulebook PDFs or proof of semantic correctness. Collection styling is scoped in `collection.css`; the existing dashboard and root navigation are not replaced.

The observer runs trusted base code only, never candidate code or downloaded artifacts. It checks complete file inventory and stable SHA, then records requirements and wouldBlock reasons without enforcement. Candidate artifacts are explicitly untrusted. The observer cannot activate on the first PR until this workflow and its rules exist in the base/default branch; after review/merge it can observe a later PR or a completed candidate run. A local test is not a GitHub run.

No model consumer, Notion/BGG write, deployment, secret configuration or repository policy changes are included.
