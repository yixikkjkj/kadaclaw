import { Alert, Button, Card, Col, Descriptions, Empty, Flex, List, Row, Statistic, Tag, Typography } from "antd";
import { useSkillInstall } from "~/store";
import { useAppStore } from "~/store";
import * as styles from "~/common/ui.css";

const { Paragraph } = Typography;

export function InstalledPage() {
  const openSkill = useAppStore((state) => state.openSkill);
  const { installedSkills, recognizedSkillIds, readySkillIds, skillOperations, skillOperationError, toggleSkillInstall } = useSkillInstall();

  return (
    <Flex vertical gap={20}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className={styles.metricCard}>
            <Statistic title="已安装技能" value={installedSkills.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className={styles.metricCard}>
            <Statistic title="OpenClaw 已识别" value={recognizedSkillIds.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className={styles.metricCard}>
            <Statistic title="可直接使用" value={readySkillIds.length} suffix="个" />
          </Card>
        </Col>
      </Row>

      <Card className={[styles.panelCard, styles.installedHero].join(" ")} title="已安装技能">
        {skillOperationError ? (
          <Alert type="error" showIcon message={skillOperationError} style={{ marginBottom: 16 }} />
        ) : null}
        <Paragraph type="secondary">
          这里展示的是已经写入 Kadaclaw 管理目录的本地技能清单，内容来自实际 manifest，而不是前端演示数据。
        </Paragraph>
        <List
          dataSource={installedSkills}
          locale={{
            emptyText: <Empty description="当前没有已安装技能" />,
          }}
          renderItem={(skill) => {
            const operation = skillOperations[skill.id];
            const busy = Boolean(operation);
            return (
              <List.Item
                actions={[
                  <Button key="view" type="link" disabled={busy} onClick={() => openSkill(skill.id)}>
                    详情
                  </Button>,
                  <Button
                    key="remove"
                    loading={busy}
                    disabled={busy}
                    onClick={() =>
                      void toggleSkillInstall({
                        id: skill.id,
                        name: skill.name,
                        summary: skill.summary,
                        category: skill.category,
                        author: skill.author,
                        version: skill.version,
                      })
                    }
                  >
                    {operation === "removing" ? "卸载中" : "卸载"}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<div className={[styles.listAvatar, styles.featuredAvatar].join(" ")}>{skill.name.slice(0, 1)}</div>}
                  title={skill.name}
                  description={`${skill.summary} · ${skill.version}`}
                />
                <Flex gap={8} wrap>
                  <Tag color="gold">{skill.category}</Tag>
                  <Tag>{skill.author}</Tag>
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

      <Card className={styles.panelCard} title="本地落盘信息">
        <Row gutter={[16, 16]}>
          {installedSkills.map((skill) => (
            <Col xs={24} md={12} key={skill.id}>
              <Card className={[styles.innerCard, styles.installedCapabilityCard].join(" ")}>
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
