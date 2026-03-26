import { Button, Card, Col, List, Progress, Row, Space, Statistic, Tag, Timeline, Typography } from "antd";
import { useEffect, useState } from "react";
import { OpenClawChatPanel } from "../components/OpenClawChatPanel";
import { activityRecords } from "../data/mock";
import { skills } from "../data/skills";
import { getOpenClawDashboardUrl, probeOpenClawRuntime, type OpenClawStatus } from "../lib/openclaw";
import { useAppStore } from "../store/appStore";

const { Paragraph, Text, Title } = Typography;

export function WorkspacePage() {
  const installedSkillIds = useAppStore((state) => state.installedSkillIds);
  const runtimeStatus = useAppStore((state) => state.runtimeStatus);
  const runtimeMessage = useAppStore((state) => state.runtimeMessage);
  const setView = useAppStore((state) => state.setView);
  const openSkill = useAppStore((state) => state.openSkill);
  const [runtimeInfo, setRuntimeInfo] = useState<OpenClawStatus | null>(null);
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);
  const [embedding, setEmbedding] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const status = await probeOpenClawRuntime();
        if (!active) {
          return;
        }
        setRuntimeInfo(status);
        if (status.reachable) {
          const dashboard = await getOpenClawDashboardUrl();
          if (!active) {
            return;
          }
          setDashboardUrl(dashboard.url);
          setEmbedding(true);
        } else {
          setEmbedding(false);
        }
      } catch {
        if (active) {
          setEmbedding(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [runtimeStatus]);

  const installedSkills = skills.filter((skill) =>
    installedSkillIds.includes(skill.id),
  );

  return (
    <Space direction="vertical" size={20} style={{ display: "flex" }}>
      <Card className="hero-card workspace-hero">
        <div className="workspace-hero-grid">
          <div className="workspace-copy">
            <Tag color="cyan" className="hero-tag">
              Kadaclaw Desktop
            </Tag>
            <Title level={1} className="workspace-title">
              把 OpenClaw 直接放进桌面聊天工作台
            </Title>
            <Paragraph className="hero-copy">
              主界面现在以聊天窗口为中心，消息会直接进入本地 OpenClaw session。技能市场、运行时控制和仪表盘仍然保留在同一个桌面客户端里。
            </Paragraph>
            <Space wrap size={12}>
              <Button type="primary" size="large" onClick={() => setView("market")}>
                浏览技能市场
              </Button>
              <Button size="large" onClick={() => setView("settings")}>
                管理 Runtime
              </Button>
            </Space>
            <div className="hero-pill-grid">
              <div className="hero-pill">
                <Text type="secondary">聊天会话</Text>
                <strong>已内置到工作台</strong>
              </div>
              <div className="hero-pill">
                <Text type="secondary">Control UI</Text>
                <strong>{embedding ? "已嵌入应用内" : "等待接入"}</strong>
              </div>
              <div className="hero-pill">
                <Text type="secondary">内置 Runtime</Text>
                <strong>{runtimeStatus === "ready" ? "可用" : "待唤起"}</strong>
              </div>
            </div>
          </div>
          <div className="workspace-aside">
            <Card className="spotlight-panel runtime-panel">
              <div className="runtime-panel-head">
                <div>
                  <Text type="secondary">Runtime 摘要</Text>
                  <Title level={3}>桌面控制中心</Title>
                </div>
                <div className="runtime-orb" />
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
              <div className="status-strip">
                <span className="status-dot" />
                <Text>{runtimeStatus === "ready" ? "已就绪" : "等待就绪"}</Text>
              </div>
              <div className="runtime-meta-grid">
                <div>
                  <Text type="secondary">仪表盘</Text>
                  <strong>{dashboardUrl ? "已发现" : "未发现"}</strong>
                </div>
                <div>
                  <Text type="secondary">检测端</Text>
                  <strong>{runtimeInfo?.endpoint ?? "--"}</strong>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="metric-card">
            <Statistic title="已安装技能" value={installedSkills.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="metric-card">
            <Statistic title="技能市场" value={skills.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="metric-card">
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
          <Space direction="vertical" size={16} style={{ display: "flex" }}>
            <Card className="panel-card" title="OpenClaw Runtime">
              <Space direction="vertical" size={10} style={{ display: "flex" }}>
                <Text type="secondary">{runtimeMessage}</Text>
                <Button type="primary" onClick={() => setView("settings")}>
                  前往配置
                </Button>
              </Space>
            </Card>
            <Card className="panel-card" title="最近运行">
              <Timeline
                items={activityRecords.map((record) => ({
                  color:
                    record.status === "成功"
                      ? "green"
                      : record.status === "运行中"
                        ? "blue"
                        : "red",
                  children: (
                    <div className="timeline-row">
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
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card
            className="panel-card console-card"
            title="OpenClaw 控制台"
            extra={
              dashboardUrl ? (
                <a href={dashboardUrl} target="_blank" rel="noreferrer">
                  在浏览器中打开
                </a>
              ) : null
            }
          >
            {embedding && dashboardUrl ? (
              <iframe className="control-frame" src={dashboardUrl} title="OpenClaw Control UI" />
            ) : (
              <div className="console-empty">
                <Title level={4}>控制台待连接</Title>
                <Paragraph type="secondary">
                  当前还没有拿到可嵌入的 OpenClaw Dashboard。先确保内置 runtime 在线，再回到这里自动接入。
                </Paragraph>
                <Space>
                  <Button type="primary" onClick={() => setView("settings")}>
                    前往安装或配置
                  </Button>
                  <Button onClick={() => void window.location.reload()}>重新检查</Button>
                </Space>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card className="panel-card" title="推荐技能">
            <List
              itemLayout="horizontal"
              dataSource={skills.filter((skill) => skill.featured)}
              renderItem={(skill) => (
                <List.Item
                  actions={[
                    <Button key={skill.id} type="link" onClick={() => openSkill(skill.id)}>
                      查看
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<div className="list-avatar featured-avatar">{skill.name.slice(0, 1)}</div>}
                    title={skill.name}
                    description={skill.summary}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
