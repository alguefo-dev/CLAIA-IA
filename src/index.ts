import { addMemory, buildSystemPrompt, listMemory, removeMemory } from "./context";
import "dotenv/config";
import { Bot } from "grammy";
import { chat, type Msg } from "./ollama";

const token = process.env.TELEGRAM_TOKEN;
if (!token) throw new Error("Falta TELEGRAM_TOKEN en el archivo .env");

const allowedId = Number(process.env.ALLOWED_USER_ID);
const bot = new Bot(token);

bot.use(async (ctx, next) => {
  const isOwner = ctx.from?.id === allowedId;
  const isIdCmd = ctx.message?.text?.startsWith("/id") ?? false;
  if (isOwner || isIdCmd) await next();
});

const history: Msg[] = [];
const MAX_MESSAGES = 10;
let busy = false;

bot.command("start", (ctx) =>
  ctx.reply("Hola, soy tu asistente de código. Escríbeme algo.")
);

// Sirve para descubrir tu ID de Telegram
bot.command("id", (ctx) => ctx.reply(`Tu ID es: ${ctx.from?.id}`));

bot.command("reset", async (ctx) => {
  if (ctx.from?.id !== allowedId) return;
  history.length = 0;
  await ctx.reply("Conversación reiniciada.");
});

bot.command("recordar", async (ctx) => {
  const text = ctx.match.trim();
  if (!text) return ctx.reply("Uso: /recordar lo que quieras que tenga en cuenta");
  try {
    const n = await addMemory(text);
    await ctx.reply(`Guardado (${n}).`);
  } catch (e) {
    await ctx.reply(e instanceof Error ? e.message : String(e));
  }
});

bot.command("memoria", async (ctx) => {
  const facts = await listMemory();
  await ctx.reply(
    facts.length ? facts.map((f, i) => `${i + 1}. ${f}`).join("\n") : "No tengo nada guardado."
  );
});

bot.command("olvidar", async (ctx) => {
  try {
    const removed = await removeMemory(Number(ctx.match.trim()));
    await ctx.reply(`Olvidado: ${removed}`);
  } catch (e) {
    await ctx.reply(e instanceof Error ? e.message : String(e));
  }
});

bot.on("message:text", async (ctx) => {
  if (ctx.from.id !== allowedId) return;
  if (busy) {
    await ctx.reply("Sigo trabajando en tu mensaje anterior...");
    return;
  }

  busy = true;
  history.push({ role: "user", content: ctx.message.text });
  const typing = setInterval(() => {
    ctx.replyWithChatAction("typing").catch(() => {});
  }, 4000);

  try {
    await ctx.replyWithChatAction("typing");
    const system = await buildSystemPrompt();
    const answer = await chat([
      { role: "system", content: system },
      ...history,
    ]);
    history.push({ role: "assistant", content: answer });
    while (history.length > MAX_MESSAGES) history.shift();

    // Telegram admite 4096 caracteres por mensaje
    for (let i = 0; i < answer.length; i += 4000) {
      await ctx.reply(answer.slice(i, i + 4000));
    }
  } catch (err) {
    console.error(err);
    history.pop();
    const detalle = err instanceof Error ? err.message : String(err);
    await ctx.reply(`Error al hablar con Ollama:\n${detalle.slice(0, 500)}`);
  } finally {
    clearInterval(typing);
    busy = false;
  }
});

bot.catch((err) => console.error("Error en el bot:", err.error));

bot.start();
console.log("CLAIA ARRANCADA");