import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#0f7b6c",
          colorBgBase: "#f6f2e8",
          colorTextBase: "#1c231f",
          borderRadius: 18,
          fontFamily:
            '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", sans-serif',
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
