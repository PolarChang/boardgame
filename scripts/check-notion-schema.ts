import { Client } from "@notionhq/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const token = process.env.NOTION_TOKEN;
  const playsDbId = process.env.NOTION_PLAYS_DB_ID;
  const playerScoresDbId = process.env.NOTION_PLAYER_SCORES_DB_ID;
  const playersDbId = process.env.NOTION_PLAYERS_DB_ID;

  if (!token) throw new Error("No token");

  const notion = new Client({ auth: token });

  // Check Plays DB schema
  if (playsDbId) {
    console.log("\n=== PLAYS DB SCHEMA ===");
    const db = await notion.databases.retrieve({ database_id: playsDbId });
    for (const [key, prop] of Object.entries(db.properties)) {
      const p = prop as any;
      console.log(`  ${key}: type=${p.type}`);
      if (p.type === "relation") {
        console.log(`    -> relation: single_property=${p.relation?.single_property}, database_id=${p.relation?.database_id || "N/A"}`);
      }
    }
  }

  // Check Player Scores DB schema
  if (playerScoresDbId) {
    console.log("\n=== PLAYER SCORES DB SCHEMA ===");
    const db = await notion.databases.retrieve({ database_id: playerScoresDbId });
    for (const [key, prop] of Object.entries(db.properties)) {
      const p = prop as any;
      console.log(`  ${key}: type=${p.type}`);
      if (p.type === "relation") {
        console.log(`    -> relation: single_property=${p.relation?.single_property}, database_id=${p.relation?.database_id || "N/A"}`);
      }
    }
  }

  // Check Players DB
  if (playersDbId) {
    console.log("\n=== PLAYERS DB SCHEMA ===");
    const db = await notion.databases.retrieve({ database_id: playersDbId });
    for (const [key, prop] of Object.entries(db.properties)) {
      const p = prop as any;
      console.log(`  ${key}: type=${p.type}`);
    }
    console.log("\n=== SAMPLE PLAYERS ===");
    const players = await notion.databases.query({ database_id: playersDbId });
    for (const page of players.results) {
      if ("properties" in page) {
        const title = Object.values(page.properties).find((p) => p.type === "title");
        const name = title?.type === "title" ? title.title.map((t: any) => t.plain_text).join("") : "?";
        console.log(`  - ${page.id}: ${name}`);
      }
    }
  }

  // Check if there are existing plays
  if (playsDbId) {
    console.log("\n=== SAMPLE PLAYS (first 3) ===");
    const plays = await notion.databases.query({ database_id: playsDbId, page_size: 3 });
    for (const page of plays.results) {
      if ("properties" in page) {
        const title = Object.values(page.properties).find((p) => p.type === "title");
        const id = title?.type === "title" ? title.title.map((t: any) => t.plain_text).join("") : "?";
        console.log(`  - ${page.id}: ${id}`);
        const props = page.properties;
        for (const [key, prop] of Object.entries(props)) {
          const p = prop as any;
          if (p.type === "date") console.log(`    Date: ${p.date?.start}`);
          if (p.type === "relation") console.log(`    ${key}: ${p.relation?.map((r: any) => r.id).join(", ")}`);
          if (p.type === "select") console.log(`    Location: ${p.select?.name}`);
          if (p.type === "rich_text") console.log(`    Notes: ${p.rich_text?.map((t: any) => t.plain_text).join("")}`);
        }
      }
    }
  }
}

main().catch(console.error);