"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

// Define what the data looks like
type Profile = {
    id: string;
    full_name: string | null;
    phone_number: string | null;
    ministry_group: string | null;
    baptism_status: string | null;
};

export function ProfileForm({ profile }: { profile: Profile }) {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    // Form State (Default to empty string if null)
    const [fullname, setFullname] = useState(profile.full_name || "");
    const [phone, setPhone] = useState(profile.phone_number || "");
    const [ministry, setMinistry] = useState(profile.ministry_group || "");
    const [baptism, setBaptism] = useState(profile.baptism_status || "Not Baptized");

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        // --- THE FIX: USE UPSERT INSTEAD OF UPDATE ---
        const { error } = await supabase
            .from("profiles")
            .upsert({
                id: profile.id, // Mandatory for upsert to know WHO to fix
                full_name: fullname,
                phone_number: phone,
                ministry_group: ministry,
                baptism_status: baptism,
                updated_at: new Date().toISOString(),
            });

        if (error) {
            console.error(error); // Log the error to console just in case
            setMessage("Error updating profile");
        } else {
            setMessage("Profile updated successfully!");
            router.refresh();
        }
        setLoading(false);
    };

    return (
        <Card className="mt-8 border-t border-gray-200 shadow-none pt-4">
            <CardHeader>
                <CardTitle>Update Your Information</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleUpdate} className="grid gap-4">

                    <div className="grid gap-2">
                        <Label>Full Name</Label>
                        <Input value={fullname} onChange={(e) => setFullname(e.target.value)} placeholder="John Doe" />
                    </div>

                    <div className="grid gap-2">
                        <Label>Phone Number</Label>
                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555-0123" />
                    </div>

                    <div className="grid gap-2">
                        <Label>Ministry Group (e.g. Choir, Ushers)</Label>
                        <Input value={ministry} onChange={(e) => setMinistry(e.target.value)} />
                    </div>

                    <div className="grid gap-2">
                        <Label>Baptism Status</Label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={baptism}
                            onChange={(e) => setBaptism(e.target.value)}
                        >
                            <option value="Not Baptized">Not Baptized</option>
                            <option value="Scheduled">Scheduled</option>
                            <option value="Baptized">Baptized</option>
                        </select>
                    </div>

                    {message && <p className="text-sm text-green-600 font-bold">{message}</p>}

                    <Button type="submit" disabled={loading}>
                        {loading ? "Saving..." : "Save Changes"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}