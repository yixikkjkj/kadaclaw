import { Flex, Space, Tag, Typography } from "antd";

const { Text, Title } = Typography;

export function AppHeaderBar() {
  return (
    <Flex align="center" justify="space-between" gap={16} wrap="wrap">
      <div>
        <Text type="secondary">产品方向</Text>
        <Title level={3} style={{ margin: 0 }}>
          类 QClaw 的 OpenClaw 客户端
        </Title>
      </div>
      <Space size={12} wrap>
        <Tag color="geekblue">Tauri</Tag>
        <Tag color="green">React</Tag>
        <Tag color="gold">Ant Design</Tag>
        <Tag color="cyan">Zustand</Tag>
        <Tag color="purple">Rspack</Tag>
      </Space>
    </Flex>
  );
}
