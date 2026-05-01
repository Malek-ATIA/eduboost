/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    typedRoutes: true,
  },
  // NOTE: Next 15.0.3's bundled SWC minifier trips with
  // "invalid unicode code point at line 1 column 16440" on certain client
  // bundles (an off-by-one in its tokenizer that surfaces after adding shared
  // components to the root layout). Skipping the minify step unblocks the
  // build; gzip transfer size barely moves because CloudFront compresses at
  // the edge. Upgrading to Next 15.4+ fixes the upstream bug.
  webpack: (config, { dev }) => {
    if (!dev) {
      config.optimization = config.optimization ?? {};
      config.optimization.minimize = false;
    }
    return config;
  },
};

export default nextConfig;
