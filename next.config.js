const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.BUNDLE_ANALYZER === 'true',
});

const withRoutes = require('nextjs-routes/config')({
  outDir: 'nextjs',
});

const headers = require('./nextjs/headers');
const redirects = require('./nextjs/redirects');
const rewrites = require('./nextjs/rewrites');

/** @type {import('next').NextConfig} */
const moduleExports = {
  transpilePackages: [
    'react-syntax-highlighter',
  ],
  reactStrictMode: true,
  webpack(config, { isServer, webpack }) {
    config.module.rules.push(
      {
        test: /\.svg$/,
        use: [ '@svgr/webpack' ],
      },
    );

    // Helia 8 / libp2p 3 import `node:stream` etc. Webpack does not handle the
    // `node:` scheme in the client bundle (UnhandledSchemeError).
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, '');
      }),
    );

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      ...(!isServer ? {
        stream: require.resolve('readable-stream'),
        buffer: require.resolve('buffer/'),
        crypto: false,
        http: false,
        https: false,
        os: false,
        path: false,
        zlib: false,
      } : {}),
    };

    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    return config;
  },
  // NOTE: all config functions should be static and not depend on any environment variables
  // since all variables will be passed to the app only at runtime and there is now way to change Next.js config at this time
  // if you are stuck and strongly believe what you need some sort of flexibility here please fill free to join the discussion
  // https://github.com/blockscout/frontend/discussions/167
  rewrites,
  redirects,
  headers,
  output: 'standalone',
  productionBrowserSourceMaps: true,
  serverExternalPackages: ["@opentelemetry/sdk-node", "@opentelemetry/auto-instrumentations-node"],
  experimental: {
    staleTimes: {
      dynamic: 30,
      'static': 180,
    },
  },
};

module.exports = withBundleAnalyzer(withRoutes(moduleExports));
