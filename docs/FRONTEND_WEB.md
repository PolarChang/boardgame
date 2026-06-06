# Frontend Web Specification

**Objective:** Build a highly responsive, Client-Side filtering gallery using Next.js 14 App Router and Tailwind CSS.

## 1. State Management (Client-Side Filtering)
Data fetching should happen Server-Side in `app/page.tsx` via `lib/notion.ts`, then passed as initial props to a Client Component (`<GameGallery initialGames={games} />`).

* **Filters required (Use standard React `useState`):**
  * `playerCount` (Number): Must fall between `Min_Players` and `Max_Players`.
  * `maxTime` (Number Slider): Filters games where `Play_Time <= maxTime`.
  * `minWeight` & `maxWeight` (Slider): Filters by `Weight`.

## 2. Component Specifications
* **`GameCard.tsx`:** * Layout: Flex column, image on top (`h-48 object-cover`), details below.
  * Typography: Tailwind `text-sm`, `font-bold` for title. 
  * Badges: Use Tailwind pill shapes (`rounded-full px-2`) for Weight and Rating.
* **`FilterBar.tsx`:** * Layout: Sticky top or sidebar. Native HTML `<input type="range">` for sliders to minimize dependencies.

## 3. Lightweight Admin Mode
* **Trigger:** Add a discreet lock icon `🔒` in the footer.
* **Action:** Prompts `window.prompt('Enter Admin Password:')`.
* **Verification:** Calls `POST /api/auth` with the password. If it matches `process.env.ADMIN_PASSWORD`, set a secure cookie (`isAdmin=true`).
* **Admin UI:** If `isAdmin` is true, render a `[+1 Play]` button on each `GameCard`.
* **Update Action:** Clicking `[+1 Play]` calls `PATCH /api/notion` with the `pageId`, incrementing the `Play_Count` property directly in Notion.