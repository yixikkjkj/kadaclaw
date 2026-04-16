import { Button, Card, Col, Flex, Input, List, Row, Statistic, Tag, Typography, message } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  installSkillFromDirectory,
  installSkillFromUrl,
  pickOpenClawLocalSkillsDir,
  type RecognizedSkillRecord,
} from "~/api";
import { ROUTE_PATHS } from "~/common/constants";
import { InstalledSkillsSection } from "~/components";
import { useSkillStore } from "~/store";
import styles from "./index.css";

const { Paragraph, Text, Title } = Typography;

export function SkillsPage() {
  const installedSkillIds = useSkillStore((state) => state.installedSkillIds);
  const recognizedSkills = useSkillStore((state) => state.recognizedSkills);
  const recognizedSkillIds = useSkillStore((state) => state.recognizedSkillIds);
  const readySkillIds = useSkillStore((state) => state.readySkillIds);
  const openSkill = useSkillStore((state) => state.openSkill);
  const refreshInstalledSkills = useSkillStore((state) => state.refreshInstalledSkills);
  const navigate = useNavigate();
  const [skillUrl, setSkillUrl] = useState("");
  const [installingFromUrl, setInstallingFromUrl] = useState(false);
  const [installingFromDirectory, setInstallingFromDirectory] = useState(false);

  const handleInstallFromDirectory = async () => {
    setInstallingFromDirectory(true);
    try {
      const directory = await pickOpenClawLocalSkillsDir();
      if (!directory) {
        return;
      }

      const installed = await installSkillFromDirectory(directory);
      await refreshInstalledSkills();
      message.success(`已导入技能：${installed.name}`);
      openSkill(installed.id);
    } catch (error) {
      message.error(`导入技能失败: ${String(error)}`);
    } finally {
      setInstallingFromDirectory(false);
    }
  };

  const handleInstallFromUrl = async () => {
    const value = skillUrl.trim();
    if (!value) {
      message.warning("请先输入技能压缩包链接");
      return;
    }

    setInstallingFromUrl(true);
    try {
      const installed = await installSkillFromUrl(value);
      setSkillUrl("");
      await refreshInstalledSkills();
      message.success(`已安装技能：${installed.name}`);
      openSkill(installed.id);
    } catch (error) {
      message.error(`安装技能失败: ${String(error)}`);
    } finally {
      setInstallingFromUrl(false);
    }
  };

  return (
    <Flex vertical gap={20}>
      <Card>
        <div className={styles.marketHero}>
          <div className={styles.marketCopy}>
            <Title level={2} style={{ margin: 0 }}>
              技能中心
            </Title>
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              这里集中展示当前工作台可调用的本地技能和 runtime 已识别技能。
            </Paragraph>
          </div>
          <div className={styles.marketStats}>
            <div className={styles.marketStatChip}>已启用技能 {installedSkillIds.length}</div>
            <div className={styles.marketStatChip}>已识别技能 {recognizedSkillIds.length}</div>
            <div className={styles.marketStatChip}>当前可用 {readySkillIds.length}</div>
          </div>
        </div>
        <div className={styles.marketFeatureBand}>
          <div>
            <Text type="secondary">能力来源</Text>
            <div className={styles.featureBandTitle}>本地目录 / Runtime 识别 / 私有技能</div>
          </div>
          <Text type="secondary">页面只展示真实存在的技能，不再混入预置演示数据。</Text>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="已启用技能" value={installedSkillIds.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="可直接调用" value={readySkillIds.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Runtime 已识别" value={recognizedSkills.length} suffix="个" />
          </Card>
        </Col>
      </Row>

      <InstalledSkillsSection />

      <Card title="安装技能">
        <Flex vertical gap={16}>
          <div className={styles.installGrid}>
            <div className={styles.installPanel}>
              <Title level={4} style={{ margin: 0 }}>
                本地导入
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                选择一个技能目录导入。目录内需要直接包含 `skill.json` 和 `SKILL.md`。
              </Paragraph>
              <Flex gap={8} wrap>
                <Button
                  type="primary"
                  loading={installingFromDirectory}
                  onClick={() => void handleInstallFromDirectory()}
                >
                  选择目录导入
                </Button>
                <Button onClick={() => navigate(ROUTE_PATHS.settings)}>
                  管理本地 Skills 目录
                </Button>
              </Flex>
            </div>

            <div className={styles.installPanel}>
              <Title level={4} style={{ margin: 0 }}>
                链接安装
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                支持 zip 链接，例如 GitHub release 产物或仓库压缩包链接。
              </Paragraph>
              <Input
                value={skillUrl}
                placeholder="https://example.com/my-skill.zip"
                onChange={(event) => setSkillUrl(event.target.value)}
                onPressEnter={() => void handleInstallFromUrl()}
              />
              <Flex gap={8} wrap>
                <Button
                  type="primary"
                  loading={installingFromUrl}
                  onClick={() => void handleInstallFromUrl()}
                >
                  从链接安装
                </Button>
              </Flex>
            </div>
          </div>
          <Text type="secondary">
            安装完成后会自动写入 Kadaclaw 托管目录，并刷新 Runtime 识别结果。
          </Text>
        </Flex>
      </Card>

      <Card title="Runtime 当前识别到的技能">
        <Paragraph type="secondary">
          这里展示的是 OpenClaw runtime 当前返回的真实技能清单。
        </Paragraph>
        <List<RecognizedSkillRecord>
          dataSource={recognizedSkills}
          locale={{
            emptyText: "当前 runtime 尚未返回可识别技能",
          }}
          renderItem={(skill) => {
            return (
              <List.Item
                actions={[
                  <Button key="view" type="link" onClick={() => openSkill(skill.name)}>
                    详情
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={skill.name}
                  description={skill.description}
                />
                <Flex gap={8} wrap justify="end">
                  <Tag color={installedSkillIds.includes(skill.name) ? "blue" : "purple"}>
                    {installedSkillIds.includes(skill.name) ? "本地已安装" : "Runtime 识别"}
                  </Tag>
                  <Tag color={skill.eligible ? "blue" : "orange"}>
                    {skill.eligible ? "可直接调用" : "已识别"}
                  </Tag>
                </Flex>
              </List.Item>
            );
          }}
        />
      </Card>
    </Flex>
  );
}
