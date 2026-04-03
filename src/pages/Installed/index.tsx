import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Flex,
  List,
  Row,
  Statistic,
  Tag,
  Typography,
} from "antd";
import { getSkillBlueprint } from "~/common/ecommerce";
import { useSkillStore } from "~/store";
import styles from "./index.css";

const { Paragraph, Text } = Typography;

export function InstalledPage() {
  const openSkill = useSkillStore((state) => state.openSkill);
  const installedSkills = useSkillStore((state) => state.installedSkills);
  const recognizedSkillIds = useSkillStore((state) => state.recognizedSkillIds);
  const readySkillIds = useSkillStore((state) => state.readySkillIds);
  const skillOperations = useSkillStore((state) => state.skillOperations);
  const skillOperationError = useSkillStore((state) => state.skillOperationError);
  const removeInstalledSkill = useSkillStore((state) => state.removeInstalledSkill);

  return (
    <Flex vertical gap={20}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="已启用能力" value={installedSkills.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="已识别能力" value={recognizedSkillIds.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="可直接调用" value={readySkillIds.length} suffix="个" />
          </Card>
        </Col>
      </Row>

      <Card title="已启用经营能力">
        {skillOperationError ? (
          <Alert type="error" showIcon message={skillOperationError} style={{ marginBottom: 16 }} />
        ) : null}
        <Paragraph type="secondary">
          这里展示的是当前工作台已启用的本地经营能力。只有被 OpenClaw 识别并就绪的能力，才能在对话中直接调用。
        </Paragraph>
        <List
          dataSource={installedSkills}
          locale={{
            emptyText: <Empty description="当前没有已安装技能" />,
          }}
          renderItem={(skill) => {
            const operation = skillOperations[skill.id];
            const busy = Boolean(operation);
            const blueprint = getSkillBlueprint({
              id: skill.id,
              name: skill.name,
              category: skill.category,
            });
            return (
              <List.Item
                actions={[
                  <Button
                    key="view"
                    type="link"
                    disabled={busy}
                    onClick={() => openSkill(skill.id)}
                  >
                    详情
                  </Button>,
                  <Button
                    key="remove"
                    loading={busy}
                    disabled={busy}
                    onClick={() => void removeInstalledSkill(skill.id, skill.name)}
                  >
                    {operation === "removing" ? "卸载中" : "卸载"}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div className={[styles.listAvatar, styles.featuredAvatar].join(" ")}>
                      {skill.name.slice(0, 1)}
                    </div>
                  }
                  title={skill.name}
                  description={
                    <Flex vertical gap={6}>
                      <Text>{skill.summary}</Text>
                      <Text type="secondary">
                        {blueprint?.summary ?? `${skill.category} 场景经营能力`} · {skill.version}
                      </Text>
                    </Flex>
                  }
                />
                <Flex gap={8} wrap>
                  <Tag color="gold">{skill.category}</Tag>
                  <Tag>{skill.author}</Tag>
                  {blueprint?.platforms.map((platform) => <Tag key={platform}>{platform}</Tag>)}
                  {recognizedSkillIds.includes(skill.id) ? (
                    <Tag color={readySkillIds.includes(skill.id) ? "blue" : "orange"}>
                      {readySkillIds.includes(skill.id) ? "已识别并就绪" : "已识别"}
                    </Tag>
                  ) : null}
                </Flex>
              </List.Item>
            );
          }}
        />
      </Card>

      <Card title="技术详情">
        <Paragraph type="secondary">
          本区域保留实际落盘信息，方便核对 manifest、目录和版本，避免业务能力与本地安装状态脱节。
        </Paragraph>
        <Row gutter={[16, 16]}>
          {installedSkills.map((skill) => (
            <Col xs={24} md={12} key={skill.id}>
              <Card>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="技能 ID">{skill.id}</Descriptions.Item>
                  <Descriptions.Item label="Manifest">{skill.manifestPath}</Descriptions.Item>
                  <Descriptions.Item label="目录">{skill.directory}</Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </Flex>
  );
}
