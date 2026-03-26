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
    main: "./src/main.tsx",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "assets/[name].[contenthash].js",
    chunkFilename: "assets/[name].[contenthash].chunk.js",
    clean: true,
    publicPath: "/",
  },
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js"],
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
        test: /\.css$/i,
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
