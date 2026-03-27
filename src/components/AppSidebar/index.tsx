import {
  ApiOutlined,
  AppstoreOutlined,
  CloudDownloadOutlined,
  RocketOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Button, Card, Flex, Layout, Menu, Typography } from "antd";
import type { MenuProps } from "antd";
import { useLocation, useNavigate } from "react-router";
import { ROUTE_PATHS } from "~/common/constants";
import * as styles from "~/common/ui.css";
import { useAppStore } from "~/store";

const { Sider } = Layout;
const { Text, Title } = Typography;

const menuItems: NonNullable<MenuProps["items"]> = [
  { key: ROUTE_PATHS.workspace, icon: <RocketOutlined />, label: "工作台" },
  { key: ROUTE_PATHS.market, icon: <AppstoreOutlined />, label: "技能市场" },
  { key: ROUTE_PATHS.installed, icon: <CloudDownloadOutlined />, label: "已安装" },
  { key: ROUTE_PATHS.settings, icon: <SettingOutlined />, label: "设置" },
];

export function AppSidebar() {
  const installedSkillIds = useAppStore((state) => state.installedSkillIds);
  const runtimeMessage = useAppStore((state) => state.runtimeMessage);
  const runtimeStatus = useAppStore((state) => state.runtimeStatus);
  const location = useLocation();
  const navigate = useNavigate();
  const selectedKey = String(
    menuItems.find((item) => location.pathname === item?.key)?.key ?? ROUTE_PATHS.market,
  );

  return (
    <Sider width={296} className={styles.appSider}>
      <div className={styles.brandPanel}>
        <div className={styles.brandMark}>K</div>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Kadaclaw
          </Title>
          <Text type="secondary">中文桌面智能工作台</Text>
        </div>
      </div>

      <Card className={styles.sidebarOverview}>
        <Text type="secondary">运行状态</Text>
        <Title level={4} style={{ marginTop: 8, marginBottom: 8 }}>
          {runtimeStatus === "ready" ? "OpenClaw 已连接" : "等待 OpenClaw Runtime"}
        </Title>
        <Text type="secondary">{runtimeMessage}</Text>
      </Card>

      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        className={styles.navMenu}
        onClick={({ key }) => navigate(String(key))}
      />

      <Card className={styles.statusCard}>
        <Flex vertical gap={8}>
          <Text type="secondary">已安装技能</Text>
          <Title level={2} style={{ margin: 0 }}>
            {installedSkillIds.length}
          </Title>
          <Button type="primary" block onClick={() => navigate(ROUTE_PATHS.market)}>
            浏览技能
          </Button>
        </Flex>
      </Card>

      <Card className={[styles.statusCard, styles.compactCard].join(" ")}>
        <Flex align="center" gap={8}>
          <ApiOutlined />
          <Text>内置 OpenClaw 由 Tauri 负责安装、启动和升级</Text>
        </Flex>
      </Card>
    </Sider>
  );
}
