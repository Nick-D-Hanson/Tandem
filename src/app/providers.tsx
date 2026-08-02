"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeProvider } from "next-themes";

import { TooltipProvider } from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth/client";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <NeonAuthUIProvider
        authClient={authClient}
        navigate={router.push}
        replace={router.replace}
        onSessionChange={() => router.refresh()}
        redirectTo="/app"
        basePath=""
        viewPaths={{
          SIGN_IN: "sign-in",
          SIGN_UP: "sign-up",
          FORGOT_PASSWORD: "forgot-password",
          RESET_PASSWORD: "reset-password",
        }}
        Link={Link}
      >
        <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
      </NeonAuthUIProvider>
    </ThemeProvider>
  );
}
