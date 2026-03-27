import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@rspack/cli";
import { HtmlRspackPlugin } from "@rspack/core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: "ts-loader",
              options: {
                transpileOnly: true,
              },
            },
          ],
        },
        {
          test: /src[\\/](?!index\.css$).*\.css$/i,
          type: "css/module",
        },
        {
          test: /src[\\/]index\.css$/i,
          type: "css",
        },
        {
          test: /\.css$/i,
          exclude: /src[\\/].*\.css$/i,
          type: "css",
        },
      ],
    },
    plugins: [
      new HtmlRspackPlugin({
        template: "./public/index.html",
      }),
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
