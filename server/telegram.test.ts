import { describe, it, expect } from "vitest";

describe("Telegram Bot Integration", () => {
  it("should successfully send a test message to Telegram", async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    expect(token).toBeTruthy();
    expect(chatId).toBeTruthy();

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✅ Panel 3D Secure - Conexión exitosa",
        parse_mode: "HTML",
      }),
    });

    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.ok).toBe(true);
  });
});
