import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// First line of defence only — every admin page, action and API route also checks the role
// server-side against the database (see requireAdmin in src/lib/auth.ts).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (pathname.startsWith("/admin")) {
    if (!token) return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url));
    if (token.role !== "ADMIN") return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/account") && !token) {
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/account/:path*"] };
