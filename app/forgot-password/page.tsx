"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    // Send the password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/dashboard/update-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Check your email! We sent you a link to reset your password.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-slate-50">
      <Card className="w-full max-w-sm shadow-md border-emerald-100">
        <CardHeader>
          <CardTitle className="text-2xl text-emerald-900">Reset Password</CardTitle>
          <CardDescription>
            Enter your email address and we will send you a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message ? (
            <div className="text-center space-y-4">
              <p className="text-green-600 font-medium bg-green-50 p-3 rounded">{message}</p>
              <Link href="/sign-in">
                <Button variant="outline" className="w-full">Back to Login</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="grid gap-2">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              
              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>

              <div className="text-center text-sm">
                <Link href="/auth/login" className="text-emerald-600 hover:underline">
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}