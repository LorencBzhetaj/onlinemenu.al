import { Suspense } from "react";
import CheckEmailClient from "./check-email-client";

export const dynamic = "force-dynamic";

export default function CheckEmailPage() {
  return (
    <Suspense fallback={null}>
      <CheckEmailClient />
    </Suspense>
  );
}
