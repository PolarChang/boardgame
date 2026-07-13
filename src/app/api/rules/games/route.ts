import { NextRequest, NextResponse } from "next/server";

const RULES_API_URL = process.env.BOARDGAME_RULES_API_URL || "http://localhost:8000";

export async function GET() {
  try {
    const response = await fetch(`${RULES_API_URL}/api/games`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Rules API error: ${response.status}`, detail: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to proxy games list:", error);
    return NextResponse.json(
      { error: "Failed to connect to rules engine" },
      { status: 502 }
    );
  }
}