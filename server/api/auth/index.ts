import { Router } from "express";
import { db } from "../../db/index.js";
import { users, roles, settings } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { verifyPassword, generateToken } from "../../core/security.js";
import { LoginSchema } from "../../../shared/schemas.js";
import { BadRequestError, UnauthorizedError } from "../../core/errors.js";

const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    const identifier = (email || "").trim().toLowerCase();
    const clinicSlug = (req.body.clinicSlug || req.body.slug || req.query.clinic || req.query.slug || "")
      .toString()
      .trim()
      .toLowerCase();

    // Tìm tất cả users và join với role để so sánh
    let userRecords: any[] = [];
    
    // Đảm bảo chạy query không bị lọc context tenant khi login
    const { appContext } = await import("../../core/context.js");
    await appContext.run({ isFullAdmin: true }, async () => {
      userRecords = await db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          passwordHash: users.passwordHash,
          isActive: users.isActive,
          roleName: roles.name,
          rolePermissions: roles.permissions,
          userPermissions: users.permissions,
          tenantId: users.tenantId,
          uiMode: users.uiMode,
          slug: users.slug,
          clinicName: users.clinicName,
          doctorName: users.doctorName,
          address: users.address,
          phone: users.phone,
          hotline: users.hotline,
        })
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id));
    });

    // Hàm kiểm tra khớp tài khoản linh hoạt
    const isUserMatch = (u: any, targetId: string) => {
      const storedEmail = (u.email || "").trim().toLowerCase();
      const storedSlug = (u.slug || "").trim().toLowerCase();
      const storedUsername = (u.username || "").trim().toLowerCase();
      const storedPhone = (u.phone || u.hotline || "").trim();

      if (storedEmail && storedEmail === targetId) return true;
      if (storedSlug && storedSlug === targetId) return true;
      if (storedUsername && storedUsername === targetId) return true;
      if (storedPhone && storedPhone === targetId) return true;

      // Hỗ trợ nhập "admin" vào tài khoản admin gốc
      if (targetId === "admin" && storedEmail === "admin@dentalsmartbooking.com") return true;

      return false;
    };

    let user: any = null;

    // 1. Nếu có clinicSlug cụ thể (đăng nhập từ trang phòng khám riêng)
    if (clinicSlug) {
      // Ưu tiên tìm tài khoản thuộc phòng khám này
      const clinicUsers = userRecords.filter((u: any) => {
        const uSlug = (u.slug || "").trim().toLowerCase();
        const uTenant = (u.tenantId || "").trim().toLowerCase();
        return uSlug === clinicSlug || uTenant === `tenant_${clinicSlug}`;
      });

      // Nếu người dùng nhập identifier khớp user của clinic
      user = clinicUsers.find((u: any) => isUserMatch(u, identifier));

      // Nếu ở trang phòng khám mà nhập "admin" hoặc "root", và clinic có 1 user quản trị duy nhất
      if (!user && (identifier === "admin" || identifier === "lephuong") && clinicUsers.length > 0) {
        user = clinicUsers[0];
      }
    }

    // 2. Nếu chưa tìm thấy, tìm trên toàn bộ danh sách users
    if (!user) {
      user = userRecords.find((u: any) => isUserMatch(u, identifier));
    }

    // 3. Fallback Firestore (Admin SDK): nếu server vừa khởi động lại làm mất file cục bộ
    if (!user) {
      try {
        const { adminDb } = await import("../../lib/firebase-admin.js");
        if (adminDb && typeof adminDb.collection === "function") {
          const qSnap = await adminDb.collection("users").get();
          qSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (isUserMatch(data, identifier) || (clinicSlug && (data.slug === clinicSlug || data.tenantId === `tenant_${clinicSlug}`))) {
              user = { id: docSnap.id, ...data };
            }
          });
        }
      } catch {
        // bỏ qua nếu Firestore Admin SDK chưa có quyền hoặc không khả dụng
      }
    }

    if (!user) {
      throw new UnauthorizedError("Tài khoản hoặc mật khẩu không chính xác");
    }

    if (user.isActive === false) {
      throw new UnauthorizedError("Tài khoản đã bị khóa");
    }

    // Verify mật khẩu
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError("Tài khoản hoặc mật khẩu không chính xác");
    }

    const mergedPermissions = Array.from(new Set([
      ...(user.rolePermissions || []),
      ...(user.userPermissions || []),
      ...(user.permissions || [])
    ]));

    // Generate Token
    const token = generateToken({
      userId: user.id,
      role: user.roleName || (mergedPermissions.includes("*") ? "admin" : "staff"),
      permissions: mergedPermissions,
      tenantId: user.tenantId,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username || user.email,
          role: user.roleName || (mergedPermissions.includes("*") ? "admin" : "staff"),
          permissions: mergedPermissions,
          tenantId: user.tenantId,
          uiMode: user.uiMode,
          slug: user.slug,
          clinicName: user.clinicName,
          doctorName: user.doctorName,
          address: user.address,
          phone: user.phone || user.hotline,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper: Resolve scoped clinic / root Google Login configuration & declared emails
 * NEVER leaks emails to public endpoints; purely evaluates authorization on server.
 */
async function resolveScopedGoogleLoginPolicy(rawClinicSlug?: string) {
  const cleanSlug = (rawClinicSlug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  const { appContext } = await import("../../core/context.js");

  let allUsers: any[] = [];
  let allSettings: any[] = [];

  await appContext.run({ isFullAdmin: true }, async () => {
    allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        isActive: users.isActive,
        roleName: roles.name,
        rolePermissions: roles.permissions,
        userPermissions: users.permissions,
        tenantId: users.tenantId,
        uiMode: users.uiMode,
        slug: users.slug,
        clinicName: users.clinicName,
        doctorName: users.doctorName,
        address: users.address,
        phone: users.phone,
        hotline: users.hotline,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id));

    allSettings = await db.select().from(settings);
  });

  // Resolve clinic users if clinicSlug is specified
  let clinicFound = !cleanSlug;
  let targetTenantId: string | null = null;
  let scopedUsers: any[] = [];

  if (cleanSlug) {
    scopedUsers = allUsers.filter((u: any) => {
      const uSlug = (u.slug || "").trim().toLowerCase();
      const uTenant = (u.tenantId || "").trim().toLowerCase();
      return uSlug === cleanSlug || uTenant === `tenant_${cleanSlug}`;
    });

    if (scopedUsers.length > 0) {
      clinicFound = true;
      targetTenantId = scopedUsers[0].tenantId || `tenant_${cleanSlug}`;
    } else {
      // Check Firestore fallback if clinic exists there
      try {
        const { findClinicBySlug } = await import("../../services/clinicFirestoreService.js");
        const lookup = await findClinicBySlug(cleanSlug);
        if (lookup?.tenantId || lookup?.clinicName) {
          clinicFound = true;
          targetTenantId = lookup.tenantId || `tenant_${cleanSlug}`;
        }
      } catch {
        // ignore lookup failure
      }
    }
  } else {
    // Root login scope: only root users (no tenantId)
    scopedUsers = allUsers.filter((u: any) => !u.tenantId);
  }

  // Load scoped googleLoginConfig from settings (STRICT tenant isolation; no fallback inheritance)
  const configSetting = allSettings.find((s: any) => {
    const isGoogleCfg = s.id === "googleLoginConfig" || s.key === "googleLoginConfig";
    if (!isGoogleCfg) return false;
    if (cleanSlug) {
      return Boolean(targetTenantId && s.tenantId === targetTenantId);
    }
    return !s.tenantId;
  });

  const configValue = (configSetting?.value && typeof configSetting.value === "object")
    ? configSetting.value
    : {};

  const googleLoginEnabled = Boolean(configValue.enabled);

  // Declared emails explicitly saved in Cài đặt > Đăng nhập bằng Gmail
  const explicitAllowedEmails: string[] = Array.isArray(configValue.allowedEmails)
    ? Array.from(
        new Set(
          configValue.allowedEmails
            .map((e: any) => String(e || "").trim().toLowerCase())
            .filter((e: string) => e.includes("@") && e.includes("."))
        )
      )
    : [];

  // Also check scoped google_sync_accounts tagged to this exact clinic/tenant
  const syncSetting = allSettings.find((s: any) => s.id === "google_sync_accounts" && !s.tenantId);
  const tenantSyncSetting = targetTenantId
    ? allSettings.find((s: any) => s.id === "google_sync_accounts" && s.tenantId === targetTenantId)
    : null;

  const allSyncEntries: any[] = [
    ...(Array.isArray(syncSetting?.value) ? syncSetting.value : []),
    ...(Array.isArray(tenantSyncSetting?.value) ? tenantSyncSetting.value : []),
  ];

  const scopedSyncAccounts = allSyncEntries.filter((a: any) => {
    if (!a || a.status === "disabled" || !a.email) return false;
    if (cleanSlug) {
      const aSlug = (a.clinicSlug || "").trim().toLowerCase();
      const aTenant = (a.tenantId || "").trim().toLowerCase();
      return (aSlug && aSlug === cleanSlug) || (targetTenantId && aTenant === targetTenantId.toLowerCase());
    }
    // Root admin sync accounts must not be scoped to a tenant clinic
    return !a.clinicSlug && !a.tenantId;
  });

  const declaredEmails = Array.from(
    new Set([
      ...explicitAllowedEmails,
      ...scopedSyncAccounts.map((a: any) => String(a.email || "").trim().toLowerCase()).filter(Boolean),
    ])
  );

  return {
    cleanSlug,
    clinicFound,
    targetTenantId,
    scopedUsers,
    googleLoginEnabled,
    declaredEmails,
    scopedSyncAccounts,
  };
}

/**
 * GET /google-login-status
 * Kiểm tra phòng khám đã bật tùy chọn đăng nhập Gmail và đã khai báo Gmail trong Cài đặt chưa.
 * Bảo mật: Tuyệt đối KHÔNG trả về danh sách địa chỉ Gmail ra ngoài public API.
 */
authRouter.get("/google-login-status", async (req, res, next) => {
  try {
    const clinicSlug = (req.query.clinicSlug || req.query.clinic || req.query.slug || "")
      .toString()
      .trim()
      .toLowerCase();

    const policy = await resolveScopedGoogleLoginPolicy(clinicSlug);

    return res.json({
      success: true,
      data: {
        clinicFound: policy.clinicFound,
        googleLoginEnabled: policy.googleLoginEnabled,
        hasDeclaredEmails: policy.declaredEmails.length > 0,
        declaredCount: policy.declaredEmails.length,
        isReady: policy.clinicFound && policy.googleLoginEnabled && policy.declaredEmails.length > 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /google
 * Đăng nhập qua tài khoản Google với xác thực Token từ Google và đối soát nghiêm ngặt
 * với tùy chọn + danh sách Gmail đã khai báo trong mục Cài đặt của chính phòng khám đó.
 */
authRouter.post("/google", async (req, res, next) => {
  try {
    const { accessToken } = req.body;
    const clinicSlug = (req.body.clinicSlug || req.body.slug || req.query.clinic || req.query.slug || "")
      .toString()
      .trim()
      .toLowerCase();

    if (!accessToken || typeof accessToken !== "string") {
      throw new UnauthorizedError("Thiếu Google Access Token hợp lệ để xác thực tài khoản.");
    }

    // 1. BẮT BUỘC xác thực trực tiếp với Google userinfo — tuyệt đối KHÔNG tin req.body.email
    let verifiedEmail = "";
    try {
      const gRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!gRes.ok) {
        throw new UnauthorizedError("Google Access Token không hợp lệ hoặc đã hết hạn.");
      }
      const gInfo: any = await gRes.json();
      if (!gInfo?.email || gInfo.email_verified === false) {
        throw new UnauthorizedError("Tài khoản Google chưa xác minh địa chỉ email.");
      }
      verifiedEmail = String(gInfo.email).trim().toLowerCase();
    } catch (tokenErr: any) {
      if (tokenErr instanceof UnauthorizedError) throw tokenErr;
      console.error("[Auth API] Failed to verify Google token:", tokenErr);
      throw new UnauthorizedError("Không thể xác thực tài khoản Google với máy chủ Google.");
    }

    console.log(`[Auth API] Verifying Google Login for verified email: ${verifiedEmail} (clinicSlug: ${clinicSlug || "root"})`);

    // 2. Lấy chính sách & danh sách Gmail đã khai báo đúng phạm vi phòng khám
    const policy = await resolveScopedGoogleLoginPolicy(clinicSlug);

    if (clinicSlug && !policy.clinicFound) {
      return res.status(404).json({
        success: false,
        error: {
          code: "CLINIC_NOT_FOUND",
          message: `Không tìm thấy phòng khám "${clinicSlug}" trong hệ thống.`,
        },
      });
    }

    // 3. Kiểm tra tùy chọn đăng nhập bằng Gmail trong Cài đặt đã được BẬT chưa
    if (!policy.googleLoginEnabled) {
      console.warn(`[Auth API][ACCESS_DENIED] Google login is disabled in Settings for ${clinicSlug || "root"} (attempted: ${verifiedEmail})`);
      return res.status(403).json({
        success: false,
        error: {
          code: "GOOGLE_LOGIN_DISABLED",
          message: "Phòng khám chưa bật tùy chọn cho phép đăng nhập bằng Gmail trong mục Cài đặt. Vui lòng đăng nhập bằng Tài khoản & Mật khẩu.",
        },
        data: {
          email: verifiedEmail,
          isWhitelisted: false,
          errorCode: "google_login_disabled",
        },
      });
    }

    // 4. Kiểm tra phòng khám đã KHAI BÁO danh sách Gmail quản trị trong Cài đặt chưa
    if (policy.declaredEmails.length === 0) {
      console.warn(`[Auth API][ACCESS_DENIED] No Gmail declared in Settings for ${clinicSlug || "root"} (attempted: ${verifiedEmail})`);
      return res.status(403).json({
        success: false,
        error: {
          code: "NO_DECLARED_GMAIL",
          message: "Phòng khám chưa khai báo Gmail quản trị nào trong mục Cài đặt. Không thể đăng nhập bằng Gmail.",
        },
        data: {
          email: verifiedEmail,
          isWhitelisted: false,
          errorCode: "no_declared_gmail",
        },
      });
    }

    // 5. Đối chiếu Gmail đã xác thực với danh sách Gmail đã khai báo của chính phòng khám này
    if (!policy.declaredEmails.includes(verifiedEmail)) {
      console.error("[Auth API][ACCESS_DENIED] Unauthorized Google login attempt:", {
        error: "access_denied",
        errorCode: "UNAUTHORIZED_EMAIL",
        attemptedEmail: verifiedEmail,
        clinicSlug: clinicSlug || "root",
        timestamp: new Date().toISOString(),
        reason: "Verified Google email is NOT in the clinic's declared Gmail list in Settings.",
      });

      return res.status(403).json({
        success: false,
        error: {
          code: "UNAUTHORIZED_EMAIL",
          message: `Gmail "${verifiedEmail}" chưa được khai báo trong mục Cài đặt của phòng khám này. Truy cập bị từ chối để bảo vệ dữ liệu.`,
        },
        data: {
          email: verifiedEmail,
          isWhitelisted: false,
          errorCode: "access_denied",
        },
      });
    }

    // 6. Khớp với tài khoản quản trị trong đúng phạm vi phòng khám (hoặc root nếu không có clinicSlug)
    let targetUser = policy.scopedUsers.find(
      (u: any) => (u.email || "").trim().toLowerCase() === verifiedEmail
    );

    // Nếu tài khoản phòng khám đăng nhập bằng username slug (VD: "lephuong") và đã khai báo Gmail trong Cài đặt,
    // ánh xạ về tài khoản quản trị đang hoạt động của chính phòng khám đó (tuyệt đối giữ nguyên tenantId).
    if (!targetUser && clinicSlug) {
      targetUser =
        policy.scopedUsers.find((u: any) => u.isActive !== false && ((u.permissions || []).includes("*") || u.roleName === "admin")) ||
        policy.scopedUsers.find((u: any) => u.isActive !== false) ||
        policy.scopedUsers[0];
    }

    if (!targetUser && !clinicSlug) {
      targetUser = policy.scopedUsers.find((u: any) => u.email === "admin@dentalsmartbooking.com") || policy.scopedUsers[0];
    }

    if (targetUser && targetUser.isActive === false) {
      console.warn("[Auth API] Clinic account is disabled:", verifiedEmail);
      throw new UnauthorizedError("Tài khoản phòng khám này đã bị tạm khóa bởi Quản trị viên");
    }

    if (!targetUser) {
      return res.status(403).json({
        success: false,
        error: {
          code: "UNAUTHORIZED_EMAIL",
          message: `Không tìm thấy tài khoản quản trị đang hoạt động cho phòng khám để liên kết với Gmail "${verifiedEmail}".`,
        },
        data: {
          email: verifiedEmail,
          isWhitelisted: false,
          errorCode: "access_denied",
        },
      });
    }

    const mergedPermissions = Array.from(
      new Set([
        ...(targetUser.rolePermissions || []),
        ...(targetUser.userPermissions || []),
      ])
    );

    const effectiveTenantId = clinicSlug
      ? (targetUser.tenantId || policy.targetTenantId || `tenant_${clinicSlug}`)
      : targetUser.tenantId;

    const token = generateToken({
      userId: targetUser.id,
      role: targetUser.roleName || (mergedPermissions.includes("*") ? "admin" : "staff"),
      permissions: mergedPermissions,
      tenantId: effectiveTenantId,
    });

    console.log(`[Auth API] Google Login verified via clinic Settings whitelist: ${verifiedEmail} -> scope: ${clinicSlug || "root"}`);

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: targetUser.id,
          email: verifiedEmail,
          username: targetUser.username || targetUser.email,
          role: targetUser.roleName || (mergedPermissions.includes("*") ? "admin" : "staff"),
          permissions: mergedPermissions,
          tenantId: effectiveTenantId,
          uiMode: targetUser.uiMode,
          slug: targetUser.slug || clinicSlug || undefined,
          clinicName: targetUser.clinicName,
          doctorName: targetUser.doctorName,
          address: targetUser.address,
          phone: targetUser.phone || targetUser.hotline,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default authRouter;
