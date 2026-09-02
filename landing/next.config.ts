import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // This project lives inside the Expo repo; pin tracing to our own folder
  // so Next doesn't pick the parent repo's lockfile as workspace root.
  outputFileTracingRoot: path.join(__dirname),
};

export default withNextIntl(nextConfig);
