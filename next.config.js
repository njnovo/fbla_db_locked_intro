/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'cdn.discordapp.com',
                port: '', // Optional: Defaults to '' (empty string) which means any port
                pathname: '/avatars/**', // Optional: Allow any path under /avatars/
            },
            // Add other allowed domains here if needed
        ],
    },
};

export default config;
