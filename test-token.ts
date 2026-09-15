import { generateToken } from "./server/core/security.js";
const token = generateToken({
  userId: "fa2d5aa4-f9bd-422f-a826-1da931e299ae",
  role: "admin",
  permissions: ["all"],
  tenantId: null
});
console.log(token);
