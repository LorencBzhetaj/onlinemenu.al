import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const path = req.nextUrl.pathname;

    // /admin/* -> vetëm SUPER_ADMIN
    if (path.startsWith("/admin") && token?.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      // Lejon vetëm përdorues të autentikuar (të tjerët -> /login).
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

// Mbron këto rrugë; /m/[slug] mbetet publike.
export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
