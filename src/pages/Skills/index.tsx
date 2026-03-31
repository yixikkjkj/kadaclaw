import { Button, Card, Col, Empty, Flex, Row, Statistic, Typography } from "antd";
import { useNavigate } from "react-router";
import { ROUTE_PATHS } from "~/common/constants";
import { useSkillStore } from "~/store";
import styles from "./index.css";

const { Paragraph, Text, Title } = Typography;

export function SkillsPage() {
  const installedSkillIds = useSkillStore((state) => state.installedSkillIds);
  const readySkillIds = useSkillStore((state) => state.readySkillIds);
  const navigate = useNavigate();

  return (
    <Flex vertical gap={20}>
      <Card>
        <div className={styles.marketHero}>
          <div className={styles.marketCopy}>
            <Title level={2} style={{ margin: 0 }}>
              Skillshub 预留页
            </Title>
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              ClawHub 相关代码和公共市场拉取链路已经移除。后续这里会接入私有 Skillshub，
              当前版本先保留为空白占位页。
            </Paragraph>
          </div>
          <div className={styles.marketStats}>
            <div className={styles.marketStatChip}>已安装 {installedSkillIds.length}</div>
            <div className={styles.marketStatChip}>已识别 {readySkillIds.length}</div>
          </div>
        </div>
        <div className={styles.marketFeatureBand}>
          <div>
            <Text type="secondary">后续规划</Text>
            <div className={styles.featureBandTitle}>私有 Skillshub / 内网接入 / 权限控制</div>
          </div>
          <Text type="secondary">当前版本不再请求任何公共技能市场。</Text>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="已安装技能" value={installedSkillIds.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="已识别技能" value={readySkillIds.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="公共市场" value="已移除" />
          </Card>
        </Col>
      </Row>

      <Card>
        <Empty description="私有 Skillshub 尚未接入，当前页面暂时留白。" />
        <Flex gap={12} wrap style={{ marginTop: 20 }}>
          <Button type="primary" onClick={() => navigate(ROUTE_PATHS.installed)}>
            查看已安装技能
          </Button>
          <Button onClick={() => navigate(ROUTE_PATHS.settings)}>前往设置</Button>
        </Flex>
      </Card>
    </Flex>
  );
}
