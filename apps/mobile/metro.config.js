const path = require("node:path");
const { withSentryConfig } = require("@sentry/react-native/metro");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const reactRoot = path.dirname(
  require.resolve("react/package.json", { paths: [__dirname] }),
);

// The web app uses React 19.2 while Expo 54 requires 19.1. Keep Metro from following
// a pnpm peer dependency into the web runtime and creating a second hook dispatcher.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    const subpath =
      moduleName === "react" ? "" : moduleName.slice("react/".length);
    return context.resolveRequest(
      context,
      path.join(reactRoot, subpath),
      platform,
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

const sentryBuildConfigured =
  Boolean(process.env.SENTRY_ORG) && Boolean(process.env.SENTRY_PROJECT);

module.exports = sentryBuildConfigured
  ? withSentryConfig(config, {
      annotateReactComponents: false,
      includeWebReplay: false,
    })
  : config;
