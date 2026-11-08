import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const path = req.nextUrl.pathname;
    const isSuperAdmin = token?.role === "SUPER_ADMIN";
    const hasRestaurant = !!token?.restaurantId;

    // Gate verifikimi (mbrojtje në thellësi; bllokimi kryesor është në server te authorize).
    // Vetëm === false bllokon — token-at e vjetër (undefined) trajtohen si të verifikuar.
    if (!isSuperAdmin && token?.emailVerified === false) {
      return NextResponse.redirect(new URL("/register/check-email", req.url));
    }

    // Super Admin s'ka dashboard/onboarding restoranti — dërgohet te /admin.
    if (isSuperAdmin && (path.startsWith("/dashboard") || path.startsWith("/onboarding"))) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    // /admin/* -> vetëm SUPER_ADMIN
    if (path.startsWith("/admin") && !isSuperAdmin) {
      return NextResponse.redirect(new URL(hasRestaurant ? "/dashboard" : "/account", req.url));
    }

    // Pa asnjë restorant (llogari përdoruesi, p.sh. e krijuar me Google): s'ka panel.
    // Biznesi krijohet VETËM kur përdoruesi zgjedh "Regjistro biznesin" (/onboarding) nga /account.
    if (!isSuperAdmin && !hasRestaurant && path.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/account", req.url));
    }

    // Kush ka tashmë restorant s'ka pse të jetë te /onboarding.
    if (hasRestaurant && path.startsWith("/onboarding")) {
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

// Mbron këto rrugë; faqet publike (katalog, profil, menu, rezervim) mbeten pa llogari.
export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/onboarding", "/account/:path*"],
};
