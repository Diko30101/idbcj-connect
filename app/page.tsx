import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function Home() {
    return (
        <div className="flex min-h-screen flex-col bg-white">

            {/* --- NAVIGATION BAR --- */}
            <nav className="flex items-center justify-between p-4 border-b border-gray-100 shadow-sm">

                {/* LOGO AND NAME */}
                <div className="flex items-center gap-3">

                    <div className="relative h-12 w-12 overflow-hidden rounded-full border border-gray-200">
                        <Image
                            src="/logo.png"
                            alt="IDBCJ Logo"
                            fill
                            className="object-cover"
                        />
                    </div>

                    <div className="text-lg font-bold text-gray-800 leading-tight max-w-[200px] sm:max-w-none">
                        Iglesia ng Dios na Buhay kay Cristo Jesus
                    </div>
                </div>

                <div className="flex gap-4">
                    <Link href="/auth/login">
                        <Button variant="outline">Member Login</Button>
                    </Link>
                    <Link href="/auth/register">
                        <Button>Join Us</Button>
                    </Link>
                </div>
            </nav>

            {/* --- HERO SECTION --- */}
            <section className="flex flex-col items-center justify-center text-center py-24 px-4 bg-slate-50">

                <div className="mb-8">
                    <Image src="/logo.png" alt="IDBCJ Logo" width={120} height={120} />
                </div>

                <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-6xl mb-6">
                    Welcome Home
                </h1>

                <p className="text-xl text-gray-600 max-w-2xl mb-10">
                    We are a community dedicated to faith, hope, and love.
                    Whether you are new to the area or looking for a place to belong,
                    you are welcome here.
                </p>

                <Link href="/sign-in">
                    <Button className="h-12 px-8 text-lg">Plan a Visit</Button>
                </Link>
            </section>

            {/* --- SERVICE TIMES --- */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto grid gap-10 md:grid-cols-2">

                    {/* Service Times */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Service Times</h2>
                        <ul className="space-y-3 text-lg text-gray-600">
                            <li className="flex justify-between">
                                <span>Sunday Worship</span>
                                <span className="font-semibold">09:00 AM</span>
                            </li>
                            <li className="flex justify-between">
                                <span>Online Bible Study</span>
                                <span className="font-semibold">07:00 PM</span>
                            </li>
                        </ul>
                    </div>

                    {/* Visit Us */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Visit Us</h2>
                        <p className="text-lg text-gray-600 mb-4">
                            Medina, Magallanes,<br />
                            Cavite, Philippines
                        </p>
                    </div>

                </div>
            </section>

            {/* --- FOOTER --- */}
            <footer className="py-10 text-center text-gray-500 text-sm border-t">
                © 2025 Iglesia ng Dios na Buhay kay Cristo Jesus. EST 1954 All rights reserved.
            </footer>

        </div>
    );
}
