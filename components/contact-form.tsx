"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // We will create this next if missing, or use standard HTML
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    
    // *** PASTE YOUR ACCESS KEY HERE ***
    formData.append("access_key", "926bfee8-dddb-404a-b270-bf677f026812"); 

    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      setSuccess(true);
      (e.target as HTMLFormElement).reset();
    } else {
      console.log("Error", data);
    }
    setLoading(false);
  }

  return (
    <Card className="max-w-xl mx-auto shadow-xl border-emerald-100">
      <CardHeader className="text-center bg-emerald-50 rounded-t-xl border-b border-emerald-100">
        <CardTitle className="text-2xl font-bold text-emerald-900">Send Us a Message</CardTitle>
        <p className="text-emerald-700 text-sm">Prayer requests, questions, or just to say hello.</p>
      </CardHeader>
      <CardContent className="p-6">
        {success ? (
          <div className="text-center py-10 animate-in fade-in zoom-in">
            <div className="text-5xl mb-4">✨</div>
            <h3 className="text-xl font-bold text-emerald-800">Message Sent!</h3>
            <p className="text-gray-600">Thank you. We will get back to you at dikovillaverde@gmail.com soon.</p>
            <Button onClick={() => setSuccess(false)} variant="outline" className="mt-6">
              Send Another
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Hidden Settings */}
            <input type="hidden" name="subject" value="New Message from Church Website" />
            <input type="hidden" name="from_name" value="Church Website" />

            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700">Your Name</label>
              <Input name="name" placeholder="Brother/Sister Name" required />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700">Email Address</label>
              <Input type="email" name="email" placeholder="you@example.com" required />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-gray-700">Message</label>
              <textarea 
                name="message" 
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="How can we pray for you today?"
                required
              />
            </div>

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-lg h-12" disabled={loading}>
              {loading ? "Sending..." : "Send Message"}
            </Button>
            
            <p className="text-xs text-center text-gray-400 mt-2">
              Protected by reCAPTCHA
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}