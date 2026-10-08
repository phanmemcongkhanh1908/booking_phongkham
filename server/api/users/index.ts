import { Router } from "express";
import { db } from "../../db/index.js";
import { users, roles } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassword } from "../../core/security.js";
import { requireAuth, requirePermission } from "../../core/middleware.js";
import { z } from "zod";
import { BadRequestError, NotFoundError } from "../../core/errors.js";

const usersRouter = Router();

usersRouter.use(requireAuth);

const CreateUserSchema = z.object({
  email: z.string().optional(),
  username: z.string().optional(),
  password: z.string().min(6, "Mật khẩu phải từ 6 ký tự trở lên").optional(),
  roleId: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  uiMode: z.string().optional(),
  slug: z.string().optional(),
  clinicName: z.string().optional(),
  slogan: z.string().optional(),
  doctorName: z.string().optional(),
  workingHoursStr: z.string().optional(),
  address: z.string().optional(),
  hotline: z.string().optional(),
}).refine(data => !!(data.username?.trim() || data.email?.trim()), {
  message: "Vui lòng nhập tên tài khoản hoặc email",
});

const UpdateUserSchema = z.object({
  password: z.string().min(6, "Mật khẩu phải từ 6 ký tự trở lên").optional(),
  isActive: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
  uiMode: z.string().optional(),
  slug: z.string().optional(),
  clinicName: z.string().optional(),
  slogan: z.string().optional(),
  doctorName: z.string().optional(),
  workingHoursStr: z.string().optional(),
  address: z.string().optional(),
  hotline: z.string().optional(),
  phone: z.string().optional(),
});

usersRouter.get("/", requirePermission("user.create"), async (req, res, next) => {
  try {
    const isFullAdmin = !req.user?.tenantId && (req.user?.role === "admin" || req.user?.permissions?.includes("*") || req.user?.permissions?.includes("all"));
    let userRecords = await db
      .select({
        id: users.id,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
        roleName: roles.name,
        permissions: users.permissions,
        rolePermissions: roles.permissions,
        tenantId: users.tenantId,
        uiMode: users.uiMode,
        slug: users.slug,
        clinicName: users.clinicName,
        doctorName: users.doctorName,
        address: users.address,
        phone: users.phone,
        hotline: users.hotline,
        workingHoursStr: users.workingHoursStr,
        slogan: users.slogan,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id));

    if (!isFullAdmin) {
      const myTenantId = req.user?.tenantId;
      userRecords = userRecords.filter((u: any) => u.tenantId === myTenantId);
    }
    
    res.json({ success: true, data: userRecords });
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/", requirePermission("user.create"), async (req, res, next) => {
  try {
    console.log("[Users API] Creating new user account...");
    console.log("[Users API] Request body keys:", Object.keys(req.body));
    console.log("[Users API] Initiator user ID:", req.user?.userId, "Tenant:", req.user?.tenantId);
    
    const { email, username, password, roleId, permissions, uiMode, slug, clinicName, slogan, doctorName, workingHoursStr, address, hotline } = CreateUserSchema.parse(req.body);
    const rawIdentifier = (username || email || "").trim();
    const identifier = rawIdentifier.toLowerCase();
    
    console.log("[Users API] Target identifier:", identifier, "Role:", roleId, "Permissions:", permissions);

    if (rawIdentifier.length < 2) {
      console.warn("[Users API] Creation failed: identifier too short.");
      throw new BadRequestError("Tên tài khoản phải có ít nhất 2 ký tự");
    }

    if (!password) {
      console.warn("[Users API] Creation failed: password missing.");
      throw new BadRequestError("Vui lòng nhập mật khẩu");
    }

    // Kiểm tra trùng lặp tài khoản và slug không phân biệt hoa thường trên toàn hệ thống
    const cleanSlug = slug ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") : "";
    
    let existingUser: any = null;
    let existingSlug: any = null;
    
    const { appContext } = await import("../../core/context.js");
    await appContext.run({ isFullAdmin: true }, async () => {
      const allUsers = await db.select().from(users);
      existingUser = allUsers.find(
        (u: any) => (u.email || "").trim().toLowerCase() === identifier
      );
      if (cleanSlug) {
        existingSlug = allUsers.find(
          (u: any) => (u.slug || "").trim().toLowerCase() === cleanSlug
        );
      }
    });

    if (existingUser) {
      console.warn("[Users API] Creation failed: identifier already exists.");
      throw new BadRequestError(`Tên tài khoản hoặc email '${rawIdentifier}' đã tồn tại trong hệ thống.`);
    }

    if (existingSlug) {
      console.warn("[Users API] Creation failed: slug already exists.");
      throw new BadRequestError(`Định danh phòng khám (Slug) '${cleanSlug}' đã được sử dụng. Vui lòng chọn slug khác.`);
    }

    let targetRoleId = roleId;
    const isFullAdmin = !permissions || permissions.length === 0 || permissions.includes("*") || permissions.includes("all");
    console.log("[Users API] Is considered Full Admin (based on requested permissions):", isFullAdmin);
    
    if (!targetRoleId) {
      if (isFullAdmin) {
        const allRoles = await db.select().from(roles);
        const defaultRole = allRoles.find(
          (r: any) => (r.name || "").trim().toLowerCase() === "admin"
        );
        if (defaultRole) {
          targetRoleId = defaultRole.id;
        } else {
          targetRoleId = "role-admin";
        }
        console.log("[Users API] Assigned default admin role ID:", targetRoleId);
      } else {
        targetRoleId = null;
        console.log("[Users API] No role assigned.");
      }
    } else {
      console.log("[Users API] Using explicitly requested role ID:", targetRoleId);
    }

    const hashedPassword = await hashPassword(password);
    
    // Nếu người tạo có tenantId, tài khoản con kế thừa tenantId đó.
    // Nếu là phòng khám mới (có slug, hoặc admin gốc tạo tài khoản), cấp 1 tenantId riêng biệt cho phòng khám.
    let newTenantId = req.user?.tenantId;
    if (!newTenantId) { 
       newTenantId = slug ? `tenant_${slug}` : `tenant_${Date.now()}`;
       console.log("[Users API] Root admin created clinic account. Generated unique tenantId:", newTenantId);
    } else {
       console.log("[Users API] Inheriting tenantId from creator:", newTenantId);
    }

    console.log("[Users API] Inserting user into database...");
    const newUser = await db.insert(users).values({
      email: identifier,
      passwordHash: hashedPassword,
      roleId: targetRoleId,
      tenantId: newTenantId,
      isActive: true,
      permissions: permissions || [],
      uiMode,
      slug,
      clinicName: clinicName || "Nha Khoa Dental Smart",
      doctorName: doctorName || "",
      address: address || "",
      phone: hotline || "",
      hotline: hotline || "",
      workingHoursStr: workingHoursStr || "",
      slogan: slogan || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();
    
    console.log("[Users API] User inserted successfully. User ID:", newUser[0]?.id);
    
    // Synchronize clinic document and user credentials to Firestore
    try {
      const { serverDb } = await import('../../lib/firebase-server.js');
      if (serverDb) {
        const { doc, setDoc } = await import('firebase/firestore');
        const userDocRef = doc(serverDb, "users", newUser[0]?.id || identifier);
        await setDoc(userDocRef, {
          id: newUser[0]?.id || identifier,
          email: identifier,
          username: rawIdentifier,
          passwordHash: hashedPassword,
          roleId: targetRoleId,
          tenantId: newTenantId,
          isActive: true,
          permissions: permissions || [],
          uiMode,
          slug,
          clinicName: clinicName || "Nha Khoa Dental Smart",
          doctorName: doctorName || "",
          address: address || "",
          phone: hotline || "",
          hotline: hotline || "",
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch((fErr) => console.warn("[Firestore] User sync warn:", fErr));
      }
    } catch (e) {
      // ignore
    }

    // Auto-create basic settings for the new tenant
    try {
      const basicSettings = {
        clinicName: clinicName || "Nha Khoa Dental Smart",
        name: clinicName || "Nha Khoa Dental Smart",
        slogan: slogan || "Nụ cười rạng rỡ, tự tin đón tương lai",
        doctorName: doctorName || "Bs. Chuyên Khoa Răng Hàm Mặt",
        workingHours: workingHoursStr || "T2 - CN: 08:00 - 20:00",
        workingHoursStr: workingHoursStr || "T2 - CN: 08:00 - 20:00",
        address: address || "123 Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh",
        phone: hotline || "0901234567",
        hotline: hotline || "0901234567"
      };
      
      const { settings } = await import('../../db/schema.js');
      await db.insert(settings).values({
        id: 'clinicProfile',
        tenantId: newTenantId,
        key: 'clinicProfile',
        value: basicSettings
      });
      await db.insert(settings).values({
        id: 'clinic_profile',
        tenantId: newTenantId,
        key: 'clinic_profile',
        value: basicSettings
      });

      // Synchronize clinic document to Firestore based on slug
      if (slug) {
        const { syncClinicToFirestore } = await import('../../services/clinicFirestoreService.js');
        syncClinicToFirestore(slug, {
          ...basicSettings,
          tenantId: newTenantId,
          slug,
        }).catch((err) => console.warn("[Firestore] syncClinicToFirestore failed:", err));
      }
    } catch(e) {
      console.log("Error creating default settings:", e);
    }

    res.json({
      success: true,
      message: `Tạo tài khoản '${rawIdentifier}' thành công!`,
      data: {
        id: newUser[0]?.id || "new-user",
        email: identifier,
        username: rawIdentifier,
        isActive: true,
        permissions: permissions || [],
        uiMode,
        slug,
        clinicName,
        doctorName,
        address,
        hotline,
        tenantId: newTenantId
      },
    });
  } catch (error) {
    console.error("[Users API] Account creation error:", error);
    next(error);
  }
});

usersRouter.put("/:id", requirePermission("user.create"), async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { 
      password, 
      isActive, 
      permissions, 
      uiMode, 
      slug,
      clinicName,
      slogan,
      doctorName,
      workingHoursStr,
      address,
      hotline,
      phone
    } = UpdateUserSchema.parse(req.body);

    const existingUsers = await db.select().from(users).where(eq(users.id, userId));
    if (existingUsers.length === 0) {
      throw new NotFoundError("Không tìm thấy người dùng");
    }

    if (existingUsers[0].email === "admin@dentalsmartbooking.com" && typeof isActive === 'boolean' && !isActive) {
      throw new BadRequestError("Không thể khóa tài khoản admin tối cao");
    }

    const updateData: any = {
      updatedAt: new Date().toISOString()
    };
    if (password) {
      updateData.passwordHash = await hashPassword(password);
    }
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }
    if (uiMode !== undefined) updateData.uiMode = uiMode;
    if (slug !== undefined) updateData.slug = slug;
    if (permissions) {
      updateData.permissions = permissions;
    }
    if (clinicName !== undefined) updateData.clinicName = clinicName;
    if (slogan !== undefined) updateData.slogan = slogan;
    if (doctorName !== undefined) updateData.doctorName = doctorName;
    if (workingHoursStr !== undefined) updateData.workingHoursStr = workingHoursStr;
    if (address !== undefined) updateData.address = address;
    if (hotline !== undefined) {
      updateData.hotline = hotline;
      updateData.phone = hotline;
    }
    if (phone !== undefined) {
      updateData.phone = phone;
      updateData.hotline = phone;
    }

    // Ensure tenantId exists if missing
    let effectiveTenantId = existingUsers[0].tenantId;
    if (!effectiveTenantId) {
      effectiveTenantId = (slug || existingUsers[0].slug) 
        ? `tenant_${slug || existingUsers[0].slug}` 
        : `tenant_${userId}`;
      updateData.tenantId = effectiveTenantId;
    }

    const updated = await db.update(users).set(updateData).where(eq(users.id, userId)).returning();
    const updatedUser = updated[0];

    // Update settings table with new clinic information
    if (effectiveTenantId && (clinicName !== undefined || doctorName !== undefined || address !== undefined || hotline !== undefined || phone !== undefined || workingHoursStr !== undefined || slogan !== undefined)) {
      try {
        const { settings } = await import('../../db/schema.js');
        const clinicProfileData = {
          clinicName: clinicName || updatedUser.clinicName || "Nha Khoa Dental Smart",
          name: clinicName || updatedUser.clinicName || "Nha Khoa Dental Smart",
          slogan: slogan || updatedUser.slogan || "Nụ cười rạng rỡ, tự tin đón tương lai",
          doctorName: doctorName || updatedUser.doctorName || "Bs. Chuyên Khoa Răng Hàm Mặt",
          workingHours: workingHoursStr || updatedUser.workingHoursStr || "T2 - CN: 08:00 - 20:00",
          workingHoursStr: workingHoursStr || updatedUser.workingHoursStr || "T2 - CN: 08:00 - 20:00",
          address: address || updatedUser.address || "123 Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh",
          phone: hotline || phone || updatedUser.phone || updatedUser.hotline || "0901234567",
          hotline: hotline || phone || updatedUser.hotline || updatedUser.phone || "0901234567",
        };
        await db.insert(settings).values({
          id: 'clinicProfile',
          tenantId: effectiveTenantId,
          key: 'clinicProfile',
          value: clinicProfileData
        });
        await db.insert(settings).values({
          id: 'clinic_profile',
          tenantId: effectiveTenantId,
          key: 'clinic_profile',
          value: clinicProfileData
        });

        const effectiveSlug = slug || updatedUser.slug;
        if (effectiveSlug) {
          const { syncClinicToFirestore } = await import('../../services/clinicFirestoreService.js');
          syncClinicToFirestore(effectiveSlug, {
            ...clinicProfileData,
            tenantId: effectiveTenantId,
            slug: effectiveSlug,
          }).catch((err) => console.warn("[Firestore] syncClinicToFirestore on user update failed:", err));
        }
      } catch (err) {
        console.warn("[Users API] Could not update clinicProfile in settings:", err);
      }
    }

    // Sync user updates to Firestore
    try {
      const { serverDb } = await import('../../lib/firebase-server.js');
      if (serverDb) {
        const { doc, setDoc } = await import('firebase/firestore');
        const userDocRef = doc(serverDb, "users", userId);
        const firestoreUpdate: any = {
          id: userId,
          updatedAt: new Date().toISOString(),
        };
        if (updateData.passwordHash) firestoreUpdate.passwordHash = updateData.passwordHash;
        if (updateData.isActive !== undefined) firestoreUpdate.isActive = updateData.isActive;
        if (updateData.slug !== undefined) firestoreUpdate.slug = updateData.slug;
        if (updateData.clinicName !== undefined) firestoreUpdate.clinicName = updateData.clinicName;
        if (updateData.doctorName !== undefined) firestoreUpdate.doctorName = updateData.doctorName;
        if (updateData.phone !== undefined) firestoreUpdate.phone = updateData.phone;
        if (updateData.tenantId !== undefined) firestoreUpdate.tenantId = updateData.tenantId;
        await setDoc(userDocRef, firestoreUpdate, { merge: true }).catch(() => {});
      }
    } catch (e) {}

    res.json({ success: true, data: updated[0] });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete("/:id", requirePermission("user.create"), async (req, res, next) => {
  try {
    const userId = req.params.id;
    
    const targetUser = await db.select().from(users).where(eq(users.id, userId));
    if (targetUser.length === 0) {
      throw new NotFoundError("Không tìm thấy tài khoản cần xóa");
    }
    if (targetUser[0].email === "admin@dentalsmartbooking.com") {
      throw new BadRequestError("Không thể xóa tài khoản admin tối cao");
    }

    // Ngăn chặn xóa chính mình
    if (req.user?.userId === userId) {
      throw new BadRequestError("Không thể xóa tài khoản đang đăng nhập");
    }

    // Clean up settings for this clinic tenant
    if (targetUser[0].tenantId) {
      try {
        const { settings } = await import("../../db/schema.js");
        await db.delete(settings).where(eq(settings.tenantId, targetUser[0].tenantId));
      } catch (e) {
        console.warn("[Users API] Could not clean up tenant settings on delete:", e);
      }
    }

    await db.delete(users).where(eq(users.id, userId));
    res.json({ success: true, message: "Đã xóa tài khoản thành công" });
  } catch (error) {
    next(error);
  }
});

export default usersRouter;
