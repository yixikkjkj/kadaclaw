import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { RouterProvider } from "react-router";
import { router } from "~/common/router";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ConfigProvider
    locale={zhCN}
    theme={{
      cssVar: {
        key: "kadaclaw",
      },
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
    <RouterProvider router={router} />
  </ConfigProvider>,
);
