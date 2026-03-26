import { Button, Card, Col, Empty, List, Row, Space, Statistic, Tag, Typography } from "antd";
import { skills } from "../data/skills";
import { useSkillInstall } from "../hooks/useSkillInstall";
import { useAppStore } from "../store/appStore";

const { Paragraph, Title } = Typography;

export function InstalledPage() {
  const installedSkillIds = useAppStore((state) => state.installedSkillIds);
  const openSkill = useAppStore((state) => state.openSkill);
  const { recognizedSkillIds, readySkillIds, toggleSkillInstall } = useSkillInstall();
  const installedSkills = skills.filter((skill) =>
    installedSkillIds.includes(skill.id),
  );

  return (
    <Space direction="vertical" size={20} style={{ display: "flex" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="metric-card">
            <Statistic title="已安装技能" value={installedSkills.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="metric-card">
            <Statistic
              title="可用兼容能力"
              value={new Set(installedSkills.flatMap((skill) => skill.compatibility)).size}
              suffix="项"
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="metric-card">
            <Statistic
              title="精选技能占比"
              value={installedSkills.filter((skill) => skill.featured).length}
              suffix={` / ${installedSkills.length || 0}`}
            />
          </Card>
        </Col>
      </Row>

      <Card className="panel-card installed-hero" title="已安装技能">
        <Paragraph type="secondary">
          这里展示的是已经进入 Kadaclaw 工作区的技能集合。下一步会把安装动作真正写入内置 OpenClaw 的私有 skills 目录。
        </Paragraph>
        <List
          dataSource={installedSkills}
          locale={{
            emptyText: <Empty description="当前没有已安装技能" />,
          }}
          renderItem={(skill) => (
            <List.Item
              actions={[
                <Button key="view" type="link" onClick={() => openSkill(skill.id)}>
                  详情
                </Button>,
                <Button key="remove" onClick={() => void toggleSkillInstall(skill)}>
                  卸载
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={<div className="list-avatar featured-avatar">{skill.name.slice(0, 1)}</div>}
                title={skill.name}
                description={`${skill.summary} · ${skill.updatedAt} 更新`}
              />
              <Space>
                <Tag color="gold">{skill.category}</Tag>
                {recognizedSkillIds.includes(skill.id) ? (
                  <Tag color={readySkillIds.includes(skill.id) ? "blue" : "orange"}>
                    {readySkillIds.includes(skill.id) ? "已识别并就绪" : "已识别"}
                  </Tag>
                ) : null}
              </Space>
            </List.Item>
          )}
        />
      </Card>

      <Card className="panel-card" title="安装后能力">
        <Row gutter={[16, 16]}>
          {installedSkills.map((skill) => (
            <Col xs={24} md={12} key={skill.id}>
              <Card className="inner-card installed-capability-card">
                <Title level={5}>{skill.name}</Title>
                <Paragraph type="secondary">{skill.description}</Paragraph>
                <div className="skill-metric-strip">
                  {skill.metrics.slice(0, 2).map((metric) => (
                    <div key={metric.label}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>
                <Space wrap>
                  {skill.compatibility.map((item) => (
                    <Tag key={item}>{item}</Tag>
                  ))}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </Space>
  );
}
