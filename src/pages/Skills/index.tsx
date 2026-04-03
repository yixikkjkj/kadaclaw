import { Button, Card, Col, Flex, Row, Statistic, Tag, Typography } from "antd";
import { useNavigate } from "react-router";
import {
  PRIMARY_SKILL_BLUEPRINTS,
  SECONDARY_SKILL_BLUEPRINTS,
  getSkillBlueprint,
} from "~/common/ecommerce";
import { ROUTE_PATHS } from "~/common/constants";
import { useSkillStore } from "~/store";
import styles from "./index.css";

const { Paragraph, Text, Title } = Typography;

export function SkillsPage() {
  const installedSkillIds = useSkillStore((state) => state.installedSkillIds);
  const readySkillIds = useSkillStore((state) => state.readySkillIds);
  const openSkill = useSkillStore((state) => state.openSkill);
  const navigate = useNavigate();

  return (
    <Flex vertical gap={20}>
      <Card>
        <div className={styles.marketHero}>
          <div className={styles.marketCopy}>
            <Title level={2} style={{ margin: 0 }}>
              电商经营场景中心
            </Title>
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              围绕发品、售后、复盘这些高频工作，提供可直接调用的经营能力。当前版本先从最常用的 3
              个场景开始，后续再补评价修复、异常订单和风险巡检。
            </Paragraph>
          </div>
          <div className={styles.marketStats}>
            <div className={styles.marketStatChip}>已启用能力 {installedSkillIds.length}</div>
            <div className={styles.marketStatChip}>当前可用 {readySkillIds.length}</div>
          </div>
        </div>
        <div className={styles.marketFeatureBand}>
          <div>
            <Text type="secondary">后续规划</Text>
            <div className={styles.featureBandTitle}>平台接入 / 上下文带入 / 私有能力中心</div>
          </div>
          <Text type="secondary">当前版本优先使用本地和私有能力，不依赖公共技能市场。</Text>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="已启用能力" value={installedSkillIds.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="可直接调用" value={readySkillIds.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="首批重点场景" value={PRIMARY_SKILL_BLUEPRINTS.length} suffix="个" />
          </Card>
        </Col>
      </Row>

      <Card title="优先启用的经营能力">
        <Row gutter={[16, 16]}>
          {PRIMARY_SKILL_BLUEPRINTS.map((item) => {
            const installed = installedSkillIds.includes(item.key);
            const ready = readySkillIds.includes(item.key);

            return (
              <Col xs={24} xl={8} key={item.key}>
                <Card className={styles.skillCard}>
                  <Flex vertical gap={14}>
                    <Flex align="center" justify="space-between" gap={8}>
                      <Tag color="gold">{item.category}</Tag>
                      {ready ? (
                        <Tag color="blue">已就绪</Tag>
                      ) : installed ? (
                        <Tag color="green">已启用</Tag>
                      ) : (
                        <Tag>待启用</Tag>
                      )}
                    </Flex>
                    <div>
                      <Title level={4} style={{ marginBottom: 8 }}>
                        {item.title}
                      </Title>
                      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        {item.summary}
                      </Paragraph>
                    </div>
                    <Flex gap={8} wrap>
                      {item.platforms.map((platform) => (
                        <Tag key={platform}>{platform}</Tag>
                      ))}
                    </Flex>
                    <div className={styles.sceneList}>
                      {item.scenes.map((scene) => (
                        <span key={scene} className={styles.sceneChip}>
                          {scene}
                        </span>
                      ))}
                    </div>
                    <Flex gap={8} wrap>
                      <Button type="primary" onClick={() => navigate(ROUTE_PATHS.chat)}>
                        去对话
                      </Button>
                      <Button onClick={() => openSkill(item.key)}>查看能力</Button>
                    </Flex>
                  </Flex>
                </Card>
              </Col>
            );
          })}
        </Row>
      </Card>

      <Card title="后续能力">
        <Row gutter={[16, 16]}>
          {SECONDARY_SKILL_BLUEPRINTS.map((item) => {
            const profile = getSkillBlueprint({ id: item.key });

            return (
              <Col xs={24} md={12} xl={8} key={item.key}>
                <Card className={styles.secondaryCard}>
                  <Flex vertical gap={10}>
                    <Flex align="center" justify="space-between" gap={8}>
                      <Text strong>{item.title}</Text>
                      <Tag>{profile?.category ?? item.category}</Tag>
                    </Flex>
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      {item.summary}
                    </Paragraph>
                    <Flex gap={8} wrap>
                      <Button size="small" onClick={() => openSkill(item.key)}>
                        查看说明
                      </Button>
                      <Button size="small" onClick={() => navigate(ROUTE_PATHS.settings)}>
                        前往接入
                      </Button>
                    </Flex>
                  </Flex>
                </Card>
              </Col>
            );
          })}
        </Row>
      </Card>
    </Flex>
  );
}
