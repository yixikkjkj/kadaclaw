import {
  ApiOutlined,
  AppstoreOutlined,
  CloudDownloadOutlined,
  RocketOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Button, Card, Layout, Menu, Space, Typography } from "antd";
import type { MenuProps } from "antd";
import { type AppView, useAppStore } from "../store/appStore";

const { Sider } = Layout;
const { Text, Title } = Typography;

const menuItems: MenuProps["items"] = [
  { key: "workspace", icon: <RocketOutlined />, label: "工作台" },
  { key: "market", icon: <AppstoreOutlined />, label: "技能市场" },
  { key: "installed", icon: <CloudDownloadOutlined />, label: "已安装" },
  { key: "settings", icon: <SettingOutlined />, label: "设置" },
];

interface AppSidebarProps {
  currentView: AppView;
}

export function AppSidebar({ currentView }: AppSidebarProps) {
  const installedSkillIds = useAppStore((state) => state.installedSkillIds);
  const runtimeMessage = useAppStore((state) => state.runtimeMessage);
  const runtimeStatus = useAppStore((state) => state.runtimeStatus);
  const setView = useAppStore((state) => state.setView);

  return (
    <Sider width={296} className="app-sider">
      <div className="brand-panel">
        <div className="brand-mark">K</div>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Kadaclaw
          </Title>
          <Text type="secondary">中文桌面智能工作台</Text>
        </div>
      </div>

      <Card className="sidebar-overview">
        <Text type="secondary">运行状态</Text>
        <Title level={4} style={{ marginTop: 8, marginBottom: 8 }}>
          {runtimeStatus === "ready" ? "OpenClaw 已连接" : "等待 OpenClaw Runtime"}
        </Title>
        <Text type="secondary">{runtimeMessage}</Text>
      </Card>

      <Menu
        mode="inline"
        selectedKeys={[currentView]}
        items={menuItems}
        className="nav-menu"
        onClick={({ key }) => setView(key as AppView)}
      />

      <Card className="status-card">
        <Space direction="vertical" size={8}>
          <Text type="secondary">已安装技能</Text>
          <Title level={2} style={{ margin: 0 }}>
            {installedSkillIds.length}
          </Title>
          <Button type="primary" block onClick={() => setView("market")}>
            浏览技能
          </Button>
        </Space>
      </Card>

      <Card className="status-card compact-card">
        <Space align="center">
          <ApiOutlined />
          <Text>内置 OpenClaw 由 Tauri 负责安装、启动和升级</Text>
        </Space>
      </Card>
    </Sider>
  );
}
