"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { useState } from "react";
import Link from "next/link"; // Import Link for the redirect
import { loginToEmail } from "@/lib/username";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);


  // 1. Function to handle Logging In
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    const supabase = createClient();

    try {
      // Username ang inilalagay ng member. Sa likod ng eksena, ginagawa itong email para sa Supabase.
      const { error } = await supabase.auth.signInWithPassword({
        email: loginToEmail(username),
        password,
      });
      if (error) throw error;
      
      // Ibalik sa pahinang pinuntahan bago siya pinag-login; kung wala, sa member portal.
      // Puwede lang ang loob ng site (nagsisimula sa "/"), para hindi magamit sa panloloko.
      const raw = new URLSearchParams(window.location.search).get("next");
      const dest =
        raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") && !raw.startsWith("/auth")
          ? raw
          : "/portal";
      window.location.assign(dest);
      return;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "";
      setError(/invalid login credentials/i.test(msg) ? "Mali ang username o password." : msg || "May problema sa pag-login. Subukan ulit.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-emerald-100 shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl text-emerald-900">Church Member Access</CardTitle>
          <CardDescription>
            Ilagay ang iyong username at password para makapasok sa IDBCJ Connect.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              
              {/* Username Input */}
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="juan.delacruz"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              {/* Password Input with Forgot Password Link */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link 
                    href="/forgot-password" 
                    className="text-sm text-emerald-600 hover:underline hover:text-emerald-800"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Kung nakalimutan mo ang password, makipag-ugnayan sa secretary o sa Presiding Minister para ma-reset ito.
                </p>
              </div>

              {/* Error Message (Red) */}
              {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
              
              <div className="flex flex-col gap-3">
                {/* LOGIN BUTTON */}
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isLoading}>
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
                
                {/* NO CREATE ACCOUNT BUTTON HERE ANYMORE */}
              </div>

            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
