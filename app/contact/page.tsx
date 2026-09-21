"use client";

import Link from "next/link"; // <--- Add this at the top
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    
    // --- PASTE YOUR ACCESS KEY BELOW ---
    formData.append("access_key", "926bfee8-dddb-404a-b270-bf677f026812"); 

    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      setResult("Success");
      (e.target as HTMLFormElement).reset(); // Clear the form
    } else {
      console.error("Error", data);
      setResult("Error");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-slate-50 py-12 px-4 flex items-center justify-center">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gray-800">Contact Leadership</CardTitle>
          <CardDescription>
            Send a message directly to the church administration. We will get back to you soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          
          {result === "Success" ? (
             <div className="text-center py-10">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-green-600 mb-2">Message Sent!</h3>
              <p className="text-gray-600 mb-6">Thank you for contacting us. Check your email for a reply shortly.</p>
              
              {/* --- NEW BUTTONS SECTION --- */}
              <div className="flex gap-4 justify-center">
                <Button onClick={() => setResult(null)} variant="outline">
                  Send Another
                </Button>
                
                <Link href="/">
                   <Button>Back to Home</Button>
                </Link>
              </div>

            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Name Field */}
              <div className="grid gap-2">
                <Label htmlFor="name">Your Name</Label>
                <Input type="text" name="name" id="name" placeholder="Brother John" required />
              </div>

              {/* Email Field */}
              <div className="grid gap-2">
                <Label htmlFor="email">Your Email</Label>
                <Input type="email" name="email" id="email" placeholder="john@example.com" required />
              </div>

              {/* Subject Field */}
              <div className="grid gap-2">
                 <Label htmlFor="subject">Subject</Label>
                 <select name="subject" id="subject" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="Website: General Inquiry">General Inquiry</option>
                    <option value="Website: Prayer Request">Prayer Request</option>
                    <option value="Website: Ministry Question">Ministry Question</option>
                    <option value="Website: Pastoral Care">Pastoral Care</option>
                 </select>
              </div>

              {/* Message Field */}
              <div className="grid gap-2">
                <Label htmlFor="message">Message</Label>
                <Textarea 
                    name="message" 
                    id="message" 
                    placeholder="How can we help you?" 
                    className="min-h-[150px]" 
                    required 
                />
              </div>

              {/* Hidden settings for Web3Forms */}
              <input type="hidden" name="from_name" value="Church Website" />

              <p className="text-xs text-center text-gray-500">
                By sending, you agree that your name, email, and message will be received by the church
                leadership by email (through the Web3Forms service) so we can reply to you. Please avoid
                sharing details you do not want shared.
              </p>

              <Button type="submit" className="w-full text-lg" disabled={loading}>
                {loading ? "Sending..." : "Send Message"}
              </Button>

              {result === "Error" && (
                <p className="text-red-500 text-center text-sm font-bold">
                  Something went wrong. Please try again later.
                </p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}