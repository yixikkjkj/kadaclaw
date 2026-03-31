import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@rspack/cli";
import { HtmlRspackPlugin } from "@rspack/core";
import ReactRefreshRspackPlugin from "@rspack/plugin-react-refresh";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const isDev = process.env.NODE_ENV === "development";
const hasReactRefreshRuntime = (() => {
  try {
    require.resolve("react-refresh");
    return true;
  } catch {
    return false;
  }
})();
const enableReactRefresh = isDev && hasReactRefreshRuntime;

export default defineConfig({
  context: __dirname,
  experiments: {
    css: true,
  },
  entry: {
    main: "./src/index.tsx",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "assets/[name].[contenthash].js",
    chunkFilename: "assets/[name].[contenthash].chunk.js",
    clean: true,
    // Let the runtime infer the correct asset base from the current script URL.
    // This avoids hard-coding "/" for Tauri bundles while keeping dev/preview working.
    publicPath: "auto",
  },
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js"],
    alias: {
      "~": path.resolve(__dirname, "src"),
    },
  },
  module: {
    parser: {
      "css/module": {
        namedExports: false,
      },
    },
    rules: [
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: "asset",
      },
      {
        test: /\.css$/i,
        type: "css/module",
      },
      {
        test: /\.(jsx?|tsx?)$/,
        use: [
          {
            loader: "builtin:swc-loader",
            options: {
              jsc: {
                parser: {
                  syntax: "typescript",
                  tsx: true,
                  decorators: true,
                },
                transform: {
                  react: {
                    runtime: "automatic",
                    development: isDev,
                    refresh: enableReactRefresh,
                  },
                },
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new HtmlRspackPlugin({
      template: "./public/index.html",
    }),
    enableReactRefresh ? new ReactRefreshRspackPlugin() : null,
  ],
  optimization: {
    runtimeChunk: "single",
    splitChunks: {
      chunks: "all",
    },
  },
  devServer: {
    host: "127.0.0.1",
    port: 1420,
    hot: true,
    historyApiFallback: true,
  },
});
