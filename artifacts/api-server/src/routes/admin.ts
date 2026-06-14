import { Router } from "express";
import { AdminLoginBody } from "@workspace/api-zod";
import {
  getSession,
  setSession,
  clearSession,
  isAdminAuthenticated,
} from "../lib/session.js";

const router = Router();

const ADMIN_LOGIN = "admin";
const ADMIN_PASSWORD = "123";

// POST /api/admin/login
router.post("/admin/login", (req, res) => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Некорректные данные" });
    return;
  }

  const { login, password } = parsed.data;

  if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
    setSession(req, res, { admin_authenticated: true });
    res.json({ success: true, message: "Вход выполнен" });
  } else {
    res.status(401).json({ success: false, message: "Неверный логин или пароль" });
  }
});

// POST /api/admin/logout
router.post("/admin/logout", (req, res) => {
  clearSession(req, res);
  res.json({ success: true, message: "Выход выполнен" });
});

// GET /api/admin/me
router.get("/admin/me", (req, res) => {
  res.json({ authenticated: isAdminAuthenticated(req) });
});

export default router;
