import fs from "fs";
import path from "path";
import { getFile, putFile } from "./github";
import type { GuestbookEntry } from "@/app/[locale]/village/world";

const FILE = "content/guestbook.json";
const IS_PROD = !!process.env.VERCEL;

function parseEntries(content: string): GuestbookEntry[] {
  const parsed: unknown = JSON.parse(content);
  if (!Array.isArray(parsed)) {
    throw new Error("Guestbook data must be an array");
  }
  return parsed as GuestbookEntry[];
}

export async function readGuestbook(): Promise<{
  entries: GuestbookEntry[];
  sha?: string;
}> {
  if (IS_PROD) {
    const file = await getFile(FILE);
    if (!file) return { entries: [] };
    return { entries: parseEntries(file.content), sha: file.sha };
  }
  const filePath = path.join(process.cwd(), FILE);
  if (!fs.existsSync(filePath)) return { entries: [] };
  return { entries: parseEntries(fs.readFileSync(filePath, "utf-8")) };
}

export async function saveGuestbook(
  entries: GuestbookEntry[],
  sha: string | undefined,
  visitorName: string
): Promise<void> {
  const json = JSON.stringify(entries, null, 2) + "\n";
  if (IS_PROD) {
    await putFile(FILE, json, `guestbook: ${visitorName}님의 나무 심기 🌳`, sha);
  } else {
    fs.writeFileSync(path.join(process.cwd(), FILE), json);
  }
}
