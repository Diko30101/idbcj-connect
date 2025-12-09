import { BunnyVideo } from "@/components/bunny-video";
import { SecureVideo } from "@/components/secure-video";
import { ProfileForm } from "@/components/profile-form";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogOut, User, Video, ShieldCheck } from "lucide-react"; 

export default async function Dashboard() {
    // 1. Setup Supabase
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore as any);

    // 2. Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return redirect("/sign-in");
    }

    // 3. Fetch the user's Church Profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    // Safety Net: Create placeholder if profile is missing
    const effectiveProfile = profile || {
        id: user.id,
        full_name: "",
        phone_number: "",
        ministry_group: "",
        baptism_status: "Not Baptized",
        status: "New Member"
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            
            {/* --- TOP HEADER --- */}
            <header className="bg-white border-b border-emerald-100 shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-xl">
                        {/* Icon placeholder if you didn't install lucide-react */}
                        <span className="text-2xl">🛡️</span> 
                        <span>Member Portal</span>
                    </div>
                    
                    <form action="/auth/sign-out" method="post">
                        <button className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-red-600 transition border px-4 py-2 rounded-lg hover:bg-red-50">
                            Sign Out
                        </button>
                    </form>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 md:px-6 py-10 space-y-10">
                
                {/* --- WELCOME MESSAGE --- */}
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Welcome, <span className="text-emerald-700">{effectiveProfile.full_name || "Member"}</span>
                    </h1>
                    <p className="text-gray-500 mt-1">We are glad you are here. Here is this week's exclusive message.</p>
                </div>

                {/* --- SECTION 1: CINEMATIC VIDEO PLAYER --- */}
                <section className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
                    <div className="bg-emerald-900 p-4 px-6 flex items-center gap-3 text-white">
                        <span>🎥</span>
                        <h2 className="font-semibold tracking-wide">Member-Only Sermon</h2>
                    </div>
                    
                    {/* Dark background for video to make it pop */}
                    <div className="p-6 md:p-10 bg-slate-900 flex justify-center">
                        <div className="w-full max-w-5xl shadow-2xl">
                            {/* Make sure the filename matches EXACTLY what you uploaded to Supabase Storage */}
                            <SecureVideo filename="bible.mp4" />
                        </div>
                    </div>
                    
                    <div className="p-4 text-center bg-emerald-50 text-emerald-800 text-sm font-medium border-t border-emerald-100">
                        This content is exclusive for registered members of IDBCJ. Please do not share outside the church.
                    </div>
                </section>

                {/* --- SECTION 2: GRID LAYOUT (Profile + Form) --- */}
                <div className="grid md:grid-cols-12 gap-8">
                    
                    {/* LEFT COLUMN: Read-Only Profile Card (Takes up 4 columns) */}
                    <div className="md:col-span-4 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                                <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 text-xl">
                                    👤
                                </div>
                                <h3 className="font-bold text-gray-800 text-lg">Your Profile</h3>
                            </div>
                            
                            <div className="space-y-5">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Full Name</label>
                                    <div className="text-gray-900 font-medium text-lg">{effectiveProfile.full_name || "Not set"}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Email</label>
                                    <div className="text-gray-600 font-medium break-all">{user.email}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Ministry</label>
                                    <div className="inline-block bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm font-semibold border border-purple-100">
                                        {effectiveProfile.ministry_group || "None"}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Status</label>
                                    <div className="text-emerald-700 font-bold flex items-center gap-2 bg-emerald-50 inline-block px-3 py-1 rounded-full text-sm border border-emerald-100">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        {effectiveProfile.status || "Active"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Edit Form (Takes up 8 columns) */}
                    {/* RIGHT COLUMN: Edit Form + Bunny Video (Takes up 8 columns) */}
                    <div className="md:col-span-8 space-y-8">
                        
                        {/* 1. The Update Form (Existing) */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="border-b border-gray-100 bg-gray-50/50 p-6">
                                <h3 className="font-bold text-gray-800 text-lg">Update Information</h3>
                                <p className="text-sm text-gray-500">Keep your church records up to date.</p>
                            </div>
                            <div className="p-6">
                                <ProfileForm profile={effectiveProfile} />
                            </div>
                        </div>

                        {/* 2. NEW: Bunny Stream Video Section */}
                        <div className="bg-white rounded-xl shadow-sm border border-emerald-100 overflow-hidden">
                            <div className="bg-emerald-900 p-4 px-6 flex items-center gap-3 text-white">
                                <span>🎥</span>
                                <h3 className="font-semibold tracking-wide">Sunday Service Archive</h3>
                            </div>
                            
                            <div className="p-6">
                                <p className="text-gray-600 mb-4 text-sm">
                                    Watch previous sermons streamed directly from our archive.
                                </p>

                                {/* PASTE YOUR BUNNY IDs HERE */}
                                <BunnyVideo 
                                    title="Sunday Worship (Replay)"
                                    libraryId="557521"   // <--- Get this from Bunny.net
                                    videoId="e2d5fe0f-f396-400c-80c7-b2971e57946f"       // <--- Get this from Bunny.net
                                />

                                <div className="mt-4 p-3 bg-blue-50 text-blue-800 text-xs rounded-lg border border-blue-100 text-center">
                                    Buffering? Try refreshing the page or checking your connection.
                                </div>
                            </div>
                        </div>

                    </div>

                </div>
            </main>
        </div>
    );
}