"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // We will create this next if missing, or use standard HTML
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Web3Forms access key (public by design; see Web3Forms FAQ)
    formData.append("access_key", "926bfee8-dddb-404a-b270-bf677f026812");

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        form.reset();
      } else {
        console.error("Error", data);
        setError(true);
      }
    } catch (err) {
      console.error("Error", err);
      setError(true);
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
            <p className="text-gray-600">Salamat! Natanggap na namin ang iyong mensahe. Babalikan ka namin sa email na inilagay mo.</p>
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
            
            {error && (
              <p className="text-red-500 text-center text-sm font-bold">
                Something went wrong. Please try again later. (Hindi naipadala ang mensahe.)
              </p>
            )}

            <p className="text-xs text-center text-gray-500 mt-2">
              By sending, you agree that your name, email, and message will be received by the church
              leadership by email (through the Web3Forms service) so we can reply to you. Please avoid
              sharing details you do not want shared.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}