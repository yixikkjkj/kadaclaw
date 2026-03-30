import { Button, Card, Col, Flex, Progress, Row, Statistic, Tag, Timeline, Typography } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { OpenClawChatPanel } from "~/components";
import { ROUTE_PATHS, activityRecords } from "~/common/constants";
import { probeOpenClawRuntime, type OpenClawStatus } from "~/api";
import { useRuntimeStore, useSkillStore } from "~/store";
import styles from "./index.css";

const { Paragraph, Text, Title } = Typography;

export function WorkspacePage() {
  const installedSkillIds = useSkillStore((state) => state.installedSkillIds);
  const runtimeStatus = useRuntimeStore((state) => state.runtimeStatus);
  const runtimeMessage = useRuntimeStore((state) => state.runtimeMessage);
  const navigate = useNavigate();
  const [runtimeInfo, setRuntimeInfo] = useState<OpenClawStatus | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const status = await probeOpenClawRuntime();
        if (!active) {
          return;
        }
        setRuntimeInfo(status);
      } catch {
        // Keep the rest of the workspace usable even if the runtime probe fails.
      }
    })();
    return () => {
      active = false;
    };
  }, [runtimeStatus]);

  return (
    <Flex vertical gap={20}>
      <Card className={styles.workspaceHero}>
        <div className={styles.workspaceHeroGrid}>
          <div className={styles.workspaceCopy}>
            <Tag color="cyan" className={styles.heroTag}>
              Kadaclaw Desktop
            </Tag>
            <Title level={1} className={styles.workspaceTitle}>
              把 OpenClaw 直接放进桌面聊天工作台
            </Title>
            <Paragraph className={styles.heroCopy}>
              主界面以聊天窗口为中心，消息会直接进入本地 OpenClaw session。公共技能市场已经移除，
              后续会在同一个客户端里接入私有 Skillshub。
            </Paragraph>
            <Flex gap={12} wrap>
              <Button type="primary" size="large" onClick={() => navigate(ROUTE_PATHS.skills)}>
                查看技能中心预留页
              </Button>
              <Button size="large" onClick={() => navigate(ROUTE_PATHS.settings)}>
                管理 Runtime
              </Button>
            </Flex>
            <div className={styles.heroPillGrid}>
              <div className={styles.heroPill}>
                <Text type="secondary">聊天会话</Text>
                <strong>已内置到工作台</strong>
              </div>
              <div className={styles.heroPill}>
                <Text type="secondary">内置 Runtime</Text>
                <strong>{runtimeStatus === "ready" ? "可用" : "待唤起"}</strong>
              </div>
            </div>
          </div>
          <div className={styles.workspaceAside}>
            <Card>
              <div className={styles.runtimePanelContent}>
                <div className={styles.runtimePanelHead}>
                  <div>
                    <Text type="secondary">Runtime 摘要</Text>
                    <Title level={3}>桌面控制中心</Title>
                  </div>
                  <div className={styles.runtimeOrb} />
                </div>
                <Paragraph type="secondary">
                  {runtimeInfo?.message ?? runtimeMessage}
                </Paragraph>
                <Progress
                  percent={runtimeStatus === "ready" ? 100 : runtimeStatus === "checking" ? 72 : 28}
                  showInfo={false}
                  strokeColor={{
                    "0%": "#0f7b6c",
                    "100%": "#d98a32",
                  }}
                  trailColor="rgba(28, 35, 31, 0.08)"
                />
                <div className={styles.statusStrip}>
                  <span className={styles.statusDot} />
                  <Text>{runtimeStatus === "ready" ? "已就绪" : "等待就绪"}</Text>
                </div>
                <div className={styles.runtimeMetaGrid}>
                  <div>
                    <Text type="secondary">检测端</Text>
                    <strong>{runtimeInfo?.endpoint ?? "--"}</strong>
                  </div>
                </div>
              </div>
            </Card>
          </div>
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
            <Statistic title="Skillshub" value="待接入" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Runtime 状态"
              value={runtimeStatus === "ready" ? "在线" : runtimeStatus === "checking" ? "检测中" : "未就绪"}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <OpenClawChatPanel />
        </Col>
        <Col xs={24} xl={9}>
          <Flex vertical gap={16}>
            <Card title="OpenClaw Runtime">
              <Flex vertical gap={10}>
                <Text type="secondary">{runtimeMessage}</Text>
                <Button type="primary" onClick={() => navigate(ROUTE_PATHS.settings)}>
                  前往配置
                </Button>
              </Flex>
            </Card>
            <Card title="最近运行">
              <Timeline
                items={activityRecords.map((record) => ({
                  color:
                    record.status === "成功"
                      ? "green"
                      : record.status === "运行中"
                        ? "blue"
                        : "red",
                  children: (
                    <div className={styles.timelineRow}>
                      <div>
                        <Text strong>{record.title}</Text>
                        <div>
                          <Text type="secondary">
                            {record.skillName} · {record.owner}
                          </Text>
                        </div>
                      </div>
                      <Text type="secondary">{record.updatedAt}</Text>
                    </div>
                  ),
                }))}
              />
            </Card>
          </Flex>
        </Col>
      </Row>
    </Flex>
  );
}
