import type { NextConfig } from "next";

const nextConfig = {
    experimental: {
        ppr: false, // <--- THIS IS THE PROBLEM
    },
};
