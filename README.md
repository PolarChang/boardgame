# BoardGameGeek Collection Showcase & Tracker

A Serverless web application using Next.js (App Router), Notion API (as CMS), and GitHub Actions for syncing BoardGameGeek (BGG) data.

## 🤖 AI Developer Instructions (Cursor Guidelines)
When generating code for this project, STRICTLY adhere to the following rules to save tokens and avoid refactoring:
1. **Stack:** Use Next.js 14+ (App Router), React, Tailwind CSS, TypeScript.
2. **No Over-engineering:** Do not use Redux, Prisma, or complex database ORMs. Use `@notionhq/client` for DB operations.
3. **No Auth Providers:** Do not implement NextAuth or Clerk. Use a simple environment variable check (`process.env.ADMIN_PASSWORD`) for the `/admin` route.
4. **Step-by-Step:** Only implement the specific file or function requested by the user. Do not preemptively generate the entire project tree.
5. **Types First:** Always rely on the TypeScript interfaces defined in `docs/SYNC_PIPELINE.md` and `docs/FRONTEND_WEB.md`.

## 📂 Project Structure
```text
├── .github/workflows/bgg-sync.yml
├── scripts/sync-bgg.ts            # Node.js script for cron job
├── src/
│   ├── app/
│   │   ├── page.tsx               # Guest view (Read-only Gallery)
│   │   ├── api/notion/route.ts    # Next.js API route for frontend requests
│   ├── components/                
│   │   ├── GameCard.tsx           
│   │   ├── FilterBar.tsx          
│   ├── lib/
│   │   ├── notion.ts              # Notion API singleton
│   │   ├── types.ts               # Shared TypeScript interfaces