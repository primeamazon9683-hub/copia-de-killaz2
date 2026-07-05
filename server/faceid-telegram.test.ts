import { describe, it, expect } from "vitest";

describe("FACE ID Telegram Bot", () => {
  it("should have valid bot token (getMe)", async () => {
    const token = process.env.TELEGRAM_FACEID_BOT_TOKEN;
    expect(token).toBeTruthy();

    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.result.id).toBeTruthy();
  });

  it("should have valid chat ID", () => {
    const chatId = process.env.TELEGRAM_FACEID_CHAT_ID;
    expect(chatId).toBeTruthy();
    expect(chatId).toBe("-5563033194");
  });
});
