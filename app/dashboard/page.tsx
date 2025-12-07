export const dynamic = "force-dynamic";

import { ProfileForm } from "@/components/profile-form";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Dashboard() {
    // 1. Setup Supabase
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 2. Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return redirect("/autho/login");
    }

    // 3. Fetch the user's Church Profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    // --- THE FIX: SAFETY NET ---
    // If profile is null (missing), create a blank placeholder
    const effectiveProfile = profile || {
        id: user.id,
        full_name: "",
        phone_number: "",
        ministry_group: "",
        baptism_status: "Not Baptized",
        status: "New Member"
    };

    return (
        <div className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
            <div className="w-full max-w-4xl bg-white shadow-md rounded-lg p-6">

                {/* Header */}
                <div className="border-b pb-4 mb-4 flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-800">Member Dashboard</h1>
                    <form action="/auth/login" method="post">
                        <button className="text-sm text-red-600 hover:underline">
                            Sign Out
                        </button>
                    </form>
                </div>

                {/* Welcome Message */}
                <h2 className="text-xl mb-6">
                    Welcome, <span className="font-semibold">{effectiveProfile.full_name || user.email}</span>
                </h2>

                {/* Member Data Card */}
                <div className="grid gap-6 md:grid-cols-2 mb-8">

                    {/* Personal Info */}
                    <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                        <h3 className="font-bold text-blue-900 mb-2">Personal Details</h3>
                        <p><strong>Email:</strong> {user.email}</p>
                        <p><strong>Phone:</strong> {effectiveProfile.phone_number || "Not set"}</p>
                        <p><strong>Member Status:</strong> {effectiveProfile.status || "Active"}</p>
                    </div>

                    {/* Ministry Info */}
                    <div className="bg-purple-50 p-4 rounded-md border border-purple-100">
                        <h3 className="font-bold text-purple-900 mb-2">Church Involvement</h3>
                        <p><strong>Ministry Group:</strong> {effectiveProfile.ministry_group || "None"}</p>
                        <p><strong>Baptism Status:</strong> {effectiveProfile.baptism_status || "Unknown"}</p>
                    </div>

                </div>

                {/* Pass the 'effectiveProfile' (which is guaranteed to exist) */}
                <ProfileForm profile={effectiveProfile} />

            </div>
        </div>
    );
}