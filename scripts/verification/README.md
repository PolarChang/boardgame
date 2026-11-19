# Verification CI bootstrap

This isolated change targets the currently committed main branch. It does not publish the pending application redesign, private knowledge UI or local model work.

- `npm test`, `npm run lint`, `npm run build`: existing application and verifier checks.
- `npm run verify:properties`: 1,000 generated recommendation bucket cases; seed defaults to 20261119, failed cases shrink with fast-check.
- `npm run verify:differential`: 2,000 identical generated inputs against `VERIFICATION_BASE` (default HEAD), preserving all output order and fields; negative control catches a dropped bucket. Results include commit, hashes, seed and shrunk counterexample in tmp/verification/differential.
- `npm run verify:observe`: requires VERIFICATION_OBSERVE_INPUT with immutable base/candidate SHA and changed files; reads rules with git show from base, never a candidate/working-tree fallback. Tests replay a candidate deleting all rules in a temporary Git repository.

The candidate workflow checks out the exact PR head with read-only permissions and no persisted credentials or repository secrets. It records actual step outcomes and marks unavailable browser/backend/PDF flows NOT_RUN; those pending local flows are not cloud acceptance evidence. Failed command results remain visible. No required status check or branch protection is configured here.

The observer runs trusted base code only, never candidate code or downloaded artifacts. It checks complete file inventory and stable SHA, then records requirements and wouldBlock reasons without enforcement. Candidate artifacts are explicitly untrusted. The observer cannot activate on the first PR until this workflow and its rules exist in the base/default branch; after review/merge it can observe a later PR or a completed candidate run. A local test is not a GitHub run.

No model consumer, Notion/BGG write, deployment, secret configuration or repository policy changes are included.
