import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import fs from "fs";
import path from "path";

// Persistent fallback key file to ensure auth tokens remain valid across server restarts
const KEY_FILE = path.join(process.cwd(), "server", "data", "jwt.key");

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  try {
    const dir = path.dirname(KEY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(KEY_FILE)) {
      JWT_SECRET = fs.readFileSync(KEY_FILE, "utf-8").trim();
    } else {
      JWT_SECRET = crypto.randomBytes(32).toString("hex");
      fs.writeFileSync(KEY_FILE, JWT_SECRET, "utf-8");
    }
  } catch (err) {
    JWT_SECRET = "dental-booking-stable-jwt-secret-key-2026";
  }
}
const SECRET = JWT_SECRET || "dental-booking-stable-jwt-secret-key-2026";

const JWT_EXPIRES_IN = "24h";

export interface TokenPayload {
  userId: string;
  role: string;
  permissions: string[];
  tenantId?: string;
}

export const hashPassword = async (password: string): Promise<string> => {
  return await argon2.hash(password);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await argon2.verify(hash, password);
};

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, SECRET) as TokenPayload;
};
