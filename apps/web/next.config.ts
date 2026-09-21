import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@abhaya/ui',
    '@abhaya/utils',
    '@abhaya/types',
    '@abhaya/validation',
    '@abhaya/client',
  ],
  poweredByHeader: false,
  devIndicators: false,
};
export default config;
