import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const path = req.nextUrl.pathname;
    const isSuperAdmin = token?.role === "SUPER_ADMIN";
    const isOwner = token?.role === "RESTAURANT_OWNER";
    const hasRestaurant = !!token?.restaurantId;

    // Gate verifikimi (mbrojtje në thellësi; bllokimi kryesor është në server te authorize).
    // Vetëm === false bllokon — token-at e vjetër (undefined) trajtohen si të verifikuar
    // që të mos nxirren jashtë sesionet ekzistuese. Super admin s'i nënshtrohet.
    if (isOwner && token?.emailVerified === false) {
      return NextResponse.redirect(new URL("/register/check-email", req.url));
    }

    // Super Admin s'ka dashboard/onboarding restoranti — dërgohet te /admin.
    if (isSuperAdmin && (path.startsWith("/dashboard") || path.startsWith("/onboarding"))) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    // /admin/* -> vetëm SUPER_ADMIN
    if (path.startsWith("/admin") && !isSuperAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Pronar PA restorant (p.sh. sapo u kyç me Google) -> duhet të kalojë /onboarding.
    if (isOwner && !hasRestaurant && !path.startsWith("/onboarding")) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }

    // Pronar QË TASHMË ka restorant s'ka pse të jetë te /onboarding.
    if (isOwner && hasRestaurant && path.startsWith("/onboarding")) {
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
  matcher: ["/dashboard/:path*", "/admin/:path*", "/onboarding"],
};
