/**
 * Create (or promote) the owner admin account.
 *
 *   npm run create-admin -- you@example.com "A-strong-password1" "Myra"
 *
 * If the email already has an account, it is promoted to ADMIN (and the password is updated
 * when one is given).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const [emailRaw, password, name] = process.argv.slice(2);
  const email = (emailRaw || "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    console.error('Usage: npm run create-admin -- you@example.com "StrongPassword1" "Your Name"');
    process.exit(1);
  }
  if (password && (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password))) {
    console.error("Use an admin password of at least 10 characters with letters and numbers.");
    process.exit(1);
  }
  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    await db.user.update({ where: { email }, data: { role: "ADMIN", ...(passwordHash ? { passwordHash } : {}), ...(name ? { name } : {}) } });
    console.log(`✔ ${email} is now an admin.`);
  } else {
    if (!passwordHash) {
      console.error("A password is required when creating a new admin account.");
      process.exit(1);
    }
    await db.user.create({ data: { email, name: name || "Owner", passwordHash, role: "ADMIN" } });
    console.log(`✔ Admin account created for ${email}. Sign in at /login, then open /admin.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
