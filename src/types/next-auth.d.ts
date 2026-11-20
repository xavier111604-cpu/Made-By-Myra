import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "CUSTOMER" | "ADMIN";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
  interface User {
    role?: "CUSTOMER" | "ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: "CUSTOMER" | "ADMIN";
  }
}
