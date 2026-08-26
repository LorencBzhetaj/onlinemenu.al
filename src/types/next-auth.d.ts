import "next-auth";
import "next-auth/jwt";

// Zgjeron tipat e NextAuth me fushat tona (role, restaurantId).
declare module "next-auth" {
  interface User {
    role?: string;
  }

  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role: string;
      restaurantId: string | null;
      restaurantSlug: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    restaurantId?: string | null;
    restaurantSlug?: string | null;
  }
}
