import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AppRoot } from "~/AppRoot";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ConfigProvider
    locale={zhCN}
    theme={{
      cssVar: {
        key: "kadaclaw",
      },
      token: {
        fontFamily: '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", sans-serif',
      },
      components: {
        Layout: {
          bodyBg: "#fff",
        },
      },
    }}
  >
    <AppRoot />
  </ConfigProvider>,
);
