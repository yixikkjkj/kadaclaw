import { Button, Card, Drawer, List, Space, Tag, Typography } from "antd";
import { useSkillInstall } from "../hooks/useSkillInstall";
import { skills } from "../data/skills";
import { useAppStore } from "../store/appStore";

const { Paragraph, Text } = Typography;

export function SkillDetailDrawer() {
  const selectedSkillId = useAppStore((state) => state.selectedSkillId);
  const skillDrawerOpen = useAppStore((state) => state.skillDrawerOpen);
  const closeSkill = useAppStore((state) => state.closeSkill);
  const { installedSkillIds, toggleSkillInstall } = useSkillInstall();
  const skill = skills.find((item) => item.id === selectedSkillId);

  if (!skill) {
    return null;
  }

  const installed = installedSkillIds.includes(skill.id);

  return (
    <Drawer
      open={skillDrawerOpen}
      width={520}
      title={skill.name}
      onClose={closeSkill}
      extra={
        <Button
          type={installed ? "default" : "primary"}
          onClick={() => void toggleSkillInstall(skill)}
        >
          {installed ? "移除技能" : "安装技能"}
        </Button>
      }
    >
      <Space direction="vertical" size={20} style={{ display: "flex" }}>
        <Space wrap>
          <Tag color="green">{skill.category}</Tag>
          <Tag>{skill.author}</Tag>
          <Tag>{skill.updatedAt} 更新</Tag>
        </Space>
        <Paragraph>{skill.description}</Paragraph>

        <Card title="关键指标">
          <List
            dataSource={skill.metrics}
            renderItem={(metric) => (
              <List.Item>
                <Text type="secondary">{metric.label}</Text>
                <Text strong>{metric.value}</Text>
              </List.Item>
            )}
          />
        </Card>

        <Card title="兼容能力">
          <Space wrap>
            {skill.compatibility.map((item) => (
              <Tag key={item} color="blue">
                {item}
              </Tag>
            ))}
          </Space>
        </Card>

        <Card title="标签">
          <Space wrap>
            {skill.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
        </Card>
      </Space>
    </Drawer>
  );
}
