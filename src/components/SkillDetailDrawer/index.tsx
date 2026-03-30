import { Alert, Button, Card, Descriptions, Drawer, Flex, Tag, Typography } from "antd";
import { useMemo } from "react";
import { useSkillStore } from "~/store";

const { Paragraph, Text } = Typography;

export function SkillDetailDrawer() {
  const selectedSkillId = useSkillStore((state) => state.selectedSkillId);
  const skillDrawerOpen = useSkillStore((state) => state.skillDrawerOpen);
  const closeSkill = useSkillStore((state) => state.closeSkill);
  const installedSkills = useSkillStore((state) => state.installedSkills);
  const installedSkillIds = useSkillStore((state) => state.installedSkillIds);
  const skillOperations = useSkillStore((state) => state.skillOperations);
  const skillOperationError = useSkillStore((state) => state.skillOperationError);
  const removeInstalledSkill = useSkillStore((state) => state.removeInstalledSkill);

  const installedSummary = useMemo(
    () => installedSkills.find((item) => item.id === selectedSkillId) ?? null,
    [installedSkills, selectedSkillId],
  );

  if (!selectedSkillId) {
    return null;
  }

  const installed = installedSkillIds.includes(selectedSkillId);
  const operation = skillOperations[selectedSkillId];
  const busy = Boolean(operation);
  const displayName = installedSummary?.name ?? selectedSkillId;
  const displaySummary = installedSummary?.summary ?? "暂无技能说明。";

  return (
    <Drawer
      open={skillDrawerOpen}
      width={560}
      title={displayName}
      onClose={closeSkill}
      extra={
        <Button
          type="primary"
          loading={busy}
          disabled={busy || !installed}
          onClick={() =>
            void removeInstalledSkill(selectedSkillId, displayName).then((removed) => {
              if (removed) {
                closeSkill();
              }
            })
          }
        >
          {operation === "removing" ? "正在移除" : "移除技能"}
        </Button>
      }
    >
      <Flex vertical gap={20}>
        {skillOperationError ? (
          <Alert type="error" showIcon message={skillOperationError} />
        ) : null}
        {!installedSummary ? (
          <Alert
            type="warning"
            showIcon
            message="当前只保留本地技能信息，未找到对应记录。"
          />
        ) : null}

        <Flex gap={8} wrap>
          <Tag color="green">v{installedSummary?.version ?? "unknown"}</Tag>
          <Tag>{installedSummary?.author ?? "本地技能"}</Tag>
          {installedSummary ? <Tag color="gold">{installedSummary.category}</Tag> : null}
        </Flex>

        <Paragraph>{displaySummary}</Paragraph>

        <Card title="本地概览">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="技能 ID">{selectedSkillId}</Descriptions.Item>
            <Descriptions.Item label="版本">{installedSummary?.version ?? "--"}</Descriptions.Item>
            <Descriptions.Item label="作者">{installedSummary?.author ?? "--"}</Descriptions.Item>
            <Descriptions.Item label="分类">{installedSummary?.category ?? "--"}</Descriptions.Item>
            {installedSummary ? (
              <Descriptions.Item label="Manifest">{installedSummary.manifestPath}</Descriptions.Item>
            ) : null}
            {installedSummary ? (
              <Descriptions.Item label="本地目录">{installedSummary.directory}</Descriptions.Item>
            ) : null}
          </Descriptions>
        </Card>

        <Card title="状态说明">
          <Text type="secondary">
            公共 ClawHub 市场接入已移除。这里现在只展示本地已安装技能信息，后续会在这一块接入私有 Skillshub。
          </Text>
        </Card>
      </Flex>
    </Drawer>
  );
}
