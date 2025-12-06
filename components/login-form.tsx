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
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({
    className,
    ...props
}: React.ComponentPropsWithoutRef<"div">) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null); // For "Check your email" success message
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    // 1. Function to handle Logging In
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setMessage(null);

        const supabase = createClient();

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
            router.push("/dashboard"); // Redirect to Member Dashboard
            router.refresh();
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    // 2. Function to handle Signing Up (New!)
    const handleSignup = async (e: React.MouseEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setMessage(null);

        const supabase = createClient();

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${location.origin}/auth/callback`,
                },
            });
            if (error) throw error;

            // Success! Tell them to check email.
            setMessage("Success! Please check your email to confirm your account.");
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Church Member Access</CardTitle>
                    <CardDescription>
                        Enter your email to login or create a new account.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin}>
                        <div className="flex flex-col gap-6">

                            {/* Email Input */}
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="m@example.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            {/* Password Input */}
                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">Password</Label>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            {/* Error Message (Red) */}
                            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

                            {/* Success Message (Green) */}
                            {message && <p className="text-sm text-green-600 font-bold border border-green-200 bg-green-50 p-2 rounded">{message}</p>}

                            <div className="flex flex-col gap-3">
                                {/* LOGIN BUTTON */}
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? "Processing..." : "Login"}
                                </Button>

                                {/* SIGN UP BUTTON (New!) */}
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={handleSignup}
                                    disabled={isLoading}
                                >
                                    Create New Account
                                </Button>
                            </div>

                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}