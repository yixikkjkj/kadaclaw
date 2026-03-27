import { Flex, Tag, Typography } from "antd";
import { useLocation } from "react-router";
import { ROUTE_PATHS } from "~/common/constants";

const { Text, Title } = Typography;

const routeMeta: Record<string, { label: string; title: string }> = {
  [ROUTE_PATHS.workspace]: {
    label: "工作台",
    title: "类 QClaw 的 OpenClaw 客户端",
  },
  [ROUTE_PATHS.market]: {
    label: "技能市场",
    title: "ClawHub 实时技能分发",
  },
  [ROUTE_PATHS.installed]: {
    label: "已安装",
    title: "本地技能目录与识别状态",
  },
  [ROUTE_PATHS.settings]: {
    label: "设置",
    title: "内置 Runtime 与授权配置",
  },
};

export function AppHeaderBar() {
  const location = useLocation();
  const meta = routeMeta[location.pathname] ?? routeMeta[ROUTE_PATHS.market];

  return (
    <Flex align="center" justify="space-between" gap={16} wrap="wrap">
      <div>
        <Text type="secondary">{meta.label}</Text>
        <Title level={3} style={{ margin: 0 }}>
          {meta.title}
        </Title>
      </div>
      <Flex gap={12} wrap>
        <Tag color="geekblue">Tauri</Tag>
        <Tag color="green">React</Tag>
        <Tag color="gold">Ant Design</Tag>
        <Tag color="cyan">Zustand</Tag>
        <Tag color="purple">Rspack</Tag>
      </Flex>
    </Flex>
  );
}
