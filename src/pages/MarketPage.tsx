import { Badge, Button, Card, Col, Flex, Input, Progress, Rate, Row, Segmented, Space, Tag, Typography } from "antd";
import { marketSources } from "../data/mock";
import { skillCategories, skills } from "../data/skills";
import { useSkillInstall } from "../hooks/useSkillInstall";
import { useAppStore } from "../store/appStore";

const { Paragraph, Text, Title } = Typography;

export function MarketPage() {
  const search = useAppStore((state) => state.search);
  const category = useAppStore((state) => state.category);
  const setSearch = useAppStore((state) => state.setSearch);
  const setCategory = useAppStore((state) => state.setCategory);
  const openSkill = useAppStore((state) => state.openSkill);
  const { installedSkillIds, recognizedSkillIds, readySkillIds, toggleSkillInstall } =
    useSkillInstall();

  const filteredSkills = skills.filter((skill) => {
    const categoryMatch = category === "全部" || skill.category === category;
    const searchMatch =
      search.trim() === "" ||
      [skill.name, skill.summary, skill.author, skill.description, ...skill.tags]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());
    return categoryMatch && searchMatch;
  });

  return (
    <Space direction="vertical" size={20} style={{ display: "flex" }}>
      <Card className="market-toolbar">
        <div className="market-hero">
          <div className="market-copy">
            <Title level={2} style={{ margin: 0 }}>
              技能市场
            </Title>
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              围绕中文业务场景组织技能。界面上先做市场体验，下一步会把安装真正写入内置 OpenClaw 的私有 skills 目录。
            </Paragraph>
          </div>
          <div className="market-stats">
            <div className="market-stat-chip">市场源 {marketSources.length}</div>
            <div className="market-stat-chip">已安装 {installedSkillIds.length}</div>
          </div>
        </div>
        <div className="market-feature-band">
          <div>
            <Text type="secondary">精选能力带</Text>
            <div className="feature-band-title">中文工作流、开发审查、内容编排</div>
          </div>
          <Progress
            percent={62}
            showInfo={false}
            strokeColor={{
              "0%": "#0f7b6c",
              "100%": "#d98a32",
            }}
            trailColor="rgba(28, 35, 31, 0.08)"
          />
        </div>
        <Row gutter={[12, 12]} style={{ marginTop: 18 }}>
          <Col xs={24} lg={14}>
            <Input.Search
              placeholder="搜索技能、作者、能力标签"
              size="large"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Col>
          <Col xs={24} lg={10}>
            <Segmented
              block
              options={[...skillCategories]}
              value={category}
              onChange={(value) => setCategory(String(value))}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        {filteredSkills.map((skill) => {
          const installed = installedSkillIds.includes(skill.id);
          const recognized = recognizedSkillIds.includes(skill.id);
          const ready = readySkillIds.includes(skill.id);
          return (
            <Col xs={24} md={12} xl={8} key={skill.id}>
              <Card className="skill-card elevated-card">
                <Flex align="center" justify="space-between" gap={12}>
                  <Flex align="center" gap={12}>
                    <div className="skill-avatar-shell">{skill.name.slice(0, 1)}</div>
                    <div>
                      <Text strong>{skill.name}</Text>
                      <div>
                        <Text type="secondary">{skill.author}</Text>
                      </div>
                    </div>
                  </Flex>
                  <Badge status={installed ? "success" : "processing"} text={installed ? "已安装" : "可安装"} />
                </Flex>

                <Paragraph className="skill-summary">{skill.summary}</Paragraph>

                <Space wrap size={[8, 8]} style={{ marginBottom: 16 }}>
                  <Tag color="green">{skill.category}</Tag>
                  {recognized ? (
                    <Tag color={ready ? "blue" : "orange"}>
                      {ready ? "OpenClaw 已就绪" : "OpenClaw 已识别"}
                    </Tag>
                  ) : null}
                  {skill.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </Space>

                <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
                  <Space>
                    <Rate disabled allowHalf value={skill.rating} />
                    <Text>{skill.rating.toFixed(1)}</Text>
                  </Space>
                  <Text type="secondary">{skill.downloads} 下载</Text>
                </Flex>

                <div className="skill-metric-strip">
                  {skill.metrics.slice(0, 2).map((metric) => (
                    <div key={metric.label}>
                      <Text type="secondary">{metric.label}</Text>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>

                <Space direction="vertical" size={10} style={{ display: "flex" }}>
                  <Button block onClick={() => openSkill(skill.id)}>
                    查看详情
                  </Button>
                  <Button
                    type={installed ? "default" : "primary"}
                    block
                    onClick={() => void toggleSkillInstall(skill)}
                  >
                    {installed ? "移除技能" : "安装技能"}
                  </Button>
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>
    </Space>
  );
}
