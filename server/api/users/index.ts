import { Router } from "express";
import { db } from "../../db/index.js";
import { users, roles } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassword } from "../../core/security.js";
import { requireAuth, requirePermission } from "../../core/middleware.js";
import { z } from "zod";
import { BadRequestError } from "../../core/errors.js";

const usersRouter = Router();

usersRouter.use(requireAuth);

const CreateUserSchema = z.object({
  email: z.string().optional(),
  username: z.string().optional(),
  password: z.string().min(6, "Mật khẩu phải từ 6 ký tự trở lên"),
  roleId: z.string().optional(),
}).refine(data => !!(data.username?.trim() || data.email?.trim()), {
  message: "Vui lòng nhập tên tài khoản hoặc email",
});

usersRouter.get("/", requirePermission("user.create"), async (req, res, next) => {
  try {
    const userRecords = await db
      .select({
        id: users.id,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
        roleName: roles.name,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id));
    res.json({ success: true, data: userRecords });
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/", requirePermission("user.create"), async (req, res, next) => {
  try {
    const { email, username, password, roleId } = CreateUserSchema.parse(req.body);
    const rawIdentifier = (username || email || "").trim();
    const identifier = rawIdentifier.toLowerCase();

    if (rawIdentifier.length < 2) {
      throw new BadRequestError("Tên tài khoản phải có ít nhất 2 ký tự");
    }

    // Kiểm tra trùng lặp không phân biệt hoa thường
    const existingUsers = await db.select().from(users);
    const existing = existingUsers.find(
      (u: any) => (u.email || "").trim().toLowerCase() === identifier
    );
    if (existing) {
      throw new BadRequestError(`Tên tài khoản hoặc email '${rawIdentifier}' đã tồn tại trong hệ thống.`);
    }

    let targetRoleId = roleId;
    if (!targetRoleId) {
      const allRoles = await db.select().from(roles);
      const defaultRole = allRoles.find(
        (r: any) => (r.name || "").trim().toLowerCase() === "admin"
      );
      if (defaultRole) {
        targetRoleId = defaultRole.id;
      } else {
        targetRoleId = "role-admin";
      }
    }

    const hashedPassword = await hashPassword(password);
    
    const newUser = await db.insert(users).values({
      email: identifier,
      passwordHash: hashedPassword,
      roleId: targetRoleId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    res.json({
      success: true,
      message: `Tạo tài khoản '${rawIdentifier}' thành công!`,
      data: {
        id: newUser[0]?.id || "new-user",
        email: identifier,
        username: rawIdentifier,
        isActive: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default usersRouter;
