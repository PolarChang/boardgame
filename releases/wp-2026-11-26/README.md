# WP-1, WP-3 through WP-8 production release

The GitHub Release includes a ZIP containing the 16 changed Vercel source files with their deployed bytes. Start with the source snapshot of the base deployment in manifest.json. Check the base hashes, extract the archive at the snapshot root, then check every release hash. Files outside the archive are inherited from that deployment. The bundled source.diff is for code review. The repository main branch has a different source tree.

The test ZIP contains ten regression test files for use with the reconstructed source and the repository Vitest setup. The deployed version passed 57 frontend tests, six fixture browser cases and four isolated Next/FastAPI/SQLite browser cases. WP-2 was excluded.
