const req = {
  user: {
    role: "admin",
    permissions: ["all"]
  }
};
const permissions = req.user.permissions || [];
const hasPermission =
  req.user.role === "admin" ||
  permissions.includes("*") ||
  permissions.includes("all") ||
  permissions.includes("provider.manage");

console.log(hasPermission);
