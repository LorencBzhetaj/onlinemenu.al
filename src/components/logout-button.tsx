"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm text-alpine-cream/60 hover:text-alpine-gold transition"
    >
      Dil
    </button>
  );
}
