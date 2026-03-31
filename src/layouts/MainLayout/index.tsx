import { Layout } from "antd";
import { Outlet } from "react-router";
import { Sidebar, SkillDetailDrawer, WindowTitleBar } from "~/components";
import styles from "./index.css";

const { Content } = Layout;

export const MainLayout = () => {
  return (
    <>
      <Layout className={styles.wrapper}>
        <Sidebar />
        <Layout style={{ backgroundColor: "#fff" }}>
          <WindowTitleBar />
          <Content className={styles.container}>
            <Outlet />
          </Content>
        </Layout>
      </Layout>
      <SkillDetailDrawer />
    </>
  );
};
