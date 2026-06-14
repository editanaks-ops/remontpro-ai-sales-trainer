import type { Request, Response, NextFunction } from "express";

const ADMIN_SESSION_KEY = "admin_authenticated";

// Simple in-memory session store (keyed by session token stored in cookie)
const sessions = new Map<string, { [key: string]: unknown }>();

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function getSession(req: Request): Record<string, unknown> {
  const token = getCookie(req, "session_token");
  if (!token) return {};
  return (sessions.get(token) as Record<string, unknown>) || {};
}

export function setSession(req: Request, res: Response, data: Record<string, unknown>): void {
  let token = getCookie(req, "session_token");
  if (!token) {
    token = generateToken();
    res.cookie("session_token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
  const existing = sessions.get(token) || {};
  sessions.set(token, { ...existing, ...data });
}

export function clearSession(req: Request, res: Response): void {
  const token = getCookie(req, "session_token");
  if (token) {
    sessions.delete(token);
  }
  res.clearCookie("session_token");
}

export function isAdminAuthenticated(req: Request): boolean {
  const session = getSession(req);
  return session[ADMIN_SESSION_KEY] === true;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminAuthenticated(req)) {
    res.status(401).json({ error: "Требуется авторизация" });
    return;
  }
  next();
}

function getCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [key, ...vals] = cookie.split("=");
    if (key?.trim() === name) {
      return vals.join("=").trim();
    }
  }
  return undefined;
}
