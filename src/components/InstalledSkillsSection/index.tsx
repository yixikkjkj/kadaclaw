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
  Switch,
  Tag,
  Typography,
} from "antd";
import { useMemo } from "react";
import {
  getSkillAuthorLabel,
  getSkillCategoryLabel,
  getSkillSourceLabel,
} from "~/common/skillDisplay";
import { useSkillStore } from "~/store";
import styles from "./index.css";

const { Paragraph, Text } = Typography;

interface InstalledSkillListItem {
  id: string;
  name: string;
  category: string;
  summary: string;
  author: string;
  version: string;
  manifestPath?: string;
  directory?: string;
  sourceLabel: string;
  sourceType: "bundled" | "local" | "runtime";
  removable: boolean;
  recognized: boolean;
  eligible: boolean;
  enabled: boolean;
}

export function InstalledSkillsSection() {
  const openSkill = useSkillStore((state) => state.openSkill);
  const installedSkills = useSkillStore((state) => state.installedSkills);
  const recognizedSkills = useSkillStore((state) => state.recognizedSkills);
  const recognizedSkillIds = useSkillStore((state) => state.recognizedSkillIds);
  const readySkillIds = useSkillStore((state) => state.readySkillIds);
  const skillOperations = useSkillStore((state) => state.skillOperations);
  const skillOperationError = useSkillStore((state) => state.skillOperationError);
  const removeInstalledSkill = useSkillStore((state) => state.removeInstalledSkill);
  const setInstalledSkillEnabled = useSkillStore((state) => state.setInstalledSkillEnabled);

  const mergedSkills = useMemo<InstalledSkillListItem[]>(() => {
    const installedItems: InstalledSkillListItem[] = installedSkills.map((skill) => ({
      ...skill,
      recognized: recognizedSkillIds.includes(skill.id),
      eligible: readySkillIds.includes(skill.id),
    }));

    const recognizedOnlyItems: InstalledSkillListItem[] = recognizedSkills
      .filter((record) => !installedSkills.some((skill) => skill.id === record.name))
      .map((record) => ({
        id: record.name,
        name: record.name,
        category: "系统能力",
        summary: record.description || "该技能已被当前系统自动识别。",
        author: "系统提供",
        version: "系统提供",
        sourceLabel: "自动识别",
        sourceType: "runtime",
        removable: false,
        recognized: true,
        eligible: record.eligible,
        enabled: !record.disabled,
      }));

    return [...installedItems, ...recognizedOnlyItems].sort((left, right) =>
      left.name.localeCompare(right.name, "zh-CN"),
    );
  }, [installedSkills, readySkillIds, recognizedSkillIds, recognizedSkills]);

  return (
    <Flex vertical gap={20}>
      <Card title="已启用技能">
        {skillOperationError ? (
          <Alert type="error" showIcon message={skillOperationError} style={{ marginBottom: 16 }} />
        ) : null}
        <Paragraph type="secondary">
          这里同时展示本地已安装技能和当前 runtime 已识别技能。只要 OpenClaw
          已识别并就绪，就可以在对话中直接调用。
        </Paragraph>
        <List
          dataSource={mergedSkills}
          locale={{
            emptyText: <Empty description="当前没有可展示的技能" />,
          }}
          renderItem={(skill) => {
            const operation = skillOperations[skill.id];
            const busy = Boolean(operation);
            return (
              <List.Item
                actions={
                  skill.sourceType === "runtime"
                    ? [
                        <Button
                          key="view"
                          type="link"
                          disabled={busy}
                          onClick={() => openSkill(skill.id)}
                        >
                          详情
                        </Button>,
                        <Button key="remove" disabled>
                          仅识别
                        </Button>,
                      ]
                    : [
                        <Switch
                          key="switch"
                          checked={skill.enabled}
                          checkedChildren="启用"
                          unCheckedChildren="关闭"
                          loading={operation === "toggling"}
                          disabled={busy}
                          onChange={(checked) =>
                            void setInstalledSkillEnabled(skill.id, skill.name, checked)
                          }
                        />,
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
                          loading={operation === "removing"}
                          disabled={busy || !skill.removable}
                          onClick={() => void removeInstalledSkill(skill.id, skill.name)}
                        >
                          {skill.removable ? "卸载" : "外部目录"}
                        </Button>,
                      ]
                }
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
                        {getSkillCategoryLabel(skill.category, skill.sourceType)} · {skill.version}
                      </Text>
                    </Flex>
                  }
                />
                <Flex gap={8} wrap>
                  <Tag color="gold">{getSkillCategoryLabel(skill.category, skill.sourceType)}</Tag>
                  <Tag>{getSkillAuthorLabel(skill.author, skill.sourceType)}</Tag>
                  <Tag
                    color={
                      skill.sourceType === "bundled"
                        ? "blue"
                        : skill.sourceType === "local"
                          ? "geekblue"
                          : "purple"
                    }
                  >
                    {getSkillSourceLabel(skill.sourceLabel, skill.sourceType)}
                  </Tag>
                  {skill.recognized ? (
                    <Tag color={skill.eligible ? "blue" : "orange"}>
                      {skill.eligible ? "已识别并就绪" : "已识别"}
                    </Tag>
                  ) : null}
                  {skill.sourceType !== "runtime" ? (
                    <Tag color={skill.enabled ? "blue" : undefined}>
                      {skill.enabled ? "已启用" : "已关闭"}
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
          本区域保留本地安装技能的实际落盘信息，方便核对 manifest、目录和版本。
        </Paragraph>
        <Row gutter={[16, 16]}>
          {installedSkills.map((skill) => (
            <Col xs={24} md={12} key={skill.id}>
              <Card>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="技能 ID">{skill.id}</Descriptions.Item>
                  <Descriptions.Item label="来源">
                    {getSkillSourceLabel(skill.sourceLabel, skill.sourceType)}
                  </Descriptions.Item>
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
