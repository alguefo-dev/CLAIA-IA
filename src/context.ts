import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const PROFILE_FILE = path.join(DATA_DIR, "profile.md");
const MEMORY_FILE = path.join(DATA_DIR, "memoria.json");

const BASE_PROMPT = `Eres CLAIA, un asistente experto en HTML, CSS, JavaScript y TypeScript.
Responde siempre en español. Da código completo, correcto y moderno, con una explicación breve.
Si te piden algo que no tiene que ver con programación web, dilo y reconduce la conversación.`;

// Límites para no comerte el contexto de 4096 tokens
const MAX_PROFILE_CHARS = 1200;
const MAX_FACTS = 20;
const MAX_FACT_CHARS = 150;

async function readProfile(): Promise<string> {
  try {
    const text = await fs.readFile(PROFILE_FILE, "utf8");
    return text.trim().slice(0, MAX_PROFILE_CHARS);
  } catch {
    return "";
  }
}

async function readMemory(): Promise<string[]> {
  try {
    const data = JSON.parse(await fs.readFile(MEMORY_FILE, "utf8"));
    return Array.isArray(data)
      ? data.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

async function saveMemory(facts: string[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(MEMORY_FILE, JSON.stringify(facts, null, 2), "utf8");
}

export const listMemory = readMemory;

export async function addMemory(text: string): Promise<number> {
  const facts = await readMemory();
  if (facts.length >= MAX_FACTS) {
    throw new Error(`Memoria llena (máx. ${MAX_FACTS}). Borra alguna con /olvidar.`);
  }
  facts.push(text.trim().slice(0, MAX_FACT_CHARS));
  await saveMemory(facts);
  return facts.length;
}

export async function removeMemory(n: number): Promise<string> {
  const facts = await readMemory();
  if (!Number.isInteger(n) || n < 1 || n > facts.length) {
    throw new Error("Número no válido. Mira la lista con /memoria.");
  }
  const [removed] = facts.splice(n - 1, 1);
  await saveMemory(facts);
  return removed;
}

// Se llama en cada mensaje: así los cambios en perfil.md se notan sin reiniciar
export async function buildSystemPrompt(): Promise<string> {
  const [profile, facts] = await Promise.all([readProfile(), readMemory()]);
  let prompt = BASE_PROMPT;
  if (profile) prompt += `\n\nPerfil del usuario y preferencias:\n${profile}`;
  if (facts.length) {
    prompt += `\n\nDatos que debes tener en cuenta:\n${facts.map((f) => `- ${f}`).join("\n")}`;
  }
  return prompt;
}