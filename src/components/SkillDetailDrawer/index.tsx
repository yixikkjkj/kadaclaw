import { Alert, Button, Card, Descriptions, Drawer, Flex, Tag, Typography } from "antd";
import { useMemo } from "react";
import {
  getSkillAuthorLabel,
  getSkillCategoryLabel,
  getSkillSourceLabel,
} from "~/common/skillDisplay";
import { useSkillStore } from "~/store";

const { Paragraph, Text } = Typography;

export function SkillDetailDrawer() {
  const selectedSkillId = useSkillStore((state) => state.selectedSkillId);
  const skillDrawerOpen = useSkillStore((state) => state.skillDrawerOpen);
  const closeSkill = useSkillStore((state) => state.closeSkill);
  const installedSkills = useSkillStore((state) => state.installedSkills);
  const recognizedSkills = useSkillStore((state) => state.recognizedSkills);
  const installedSkillIds = useSkillStore((state) => state.installedSkillIds);
  const readySkillIds = useSkillStore((state) => state.readySkillIds);
  const skillOperations = useSkillStore((state) => state.skillOperations);
  const skillOperationError = useSkillStore((state) => state.skillOperationError);
  const removeInstalledSkill = useSkillStore((state) => state.removeInstalledSkill);

  const installedSummary = useMemo(
    () => installedSkills.find((item) => item.id === selectedSkillId) ?? null,
    [installedSkills, selectedSkillId],
  );
  const recognizedSummary = useMemo(
    () => recognizedSkills.find((item) => item.name === selectedSkillId) ?? null,
    [recognizedSkills, selectedSkillId],
  );

  if (!selectedSkillId) {
    return null;
  }

  const installed = installedSkillIds.includes(selectedSkillId);
  const ready = readySkillIds.includes(selectedSkillId);
  const operation = skillOperations[selectedSkillId];
  const busy = Boolean(operation);
  const displayName = installedSummary?.name ?? recognizedSummary?.name ?? selectedSkillId;
  const displaySummary =
    installedSummary?.summary ?? recognizedSummary?.description ?? "暂无技能说明。";
  const enabled =
    installedSummary?.enabled ?? (recognizedSummary ? !recognizedSummary.disabled : false);

  return (
    <Drawer
      open={skillDrawerOpen}
      width={560}
      title={displayName}
      onClose={closeSkill}
      extra={
        installed && installedSummary?.removable ? (
          <Button
            type="primary"
            loading={busy}
            disabled={busy}
            onClick={() =>
              void removeInstalledSkill(selectedSkillId, displayName).then((removed) => {
                if (removed) {
                  closeSkill();
                }
              })
            }
          >
            {operation === "removing" ? "正在移除" : "移除能力"}
          </Button>
        ) : null
      }
    >
      <Flex vertical gap={20}>
        {skillOperationError ? <Alert type="error" showIcon message={skillOperationError} /> : null}
        {!installed ? (
          <Alert
            type="info"
            showIcon
            message={recognizedSummary ? "当前能力已被系统自动识别" : "当前能力尚未启用"}
            description={
              recognizedSummary
                ? "该能力已经被当前系统识别，但本地没有对应 manifest。你仍然可以查看说明并在对话中尝试调用。"
                : "你可以先查看输入要求和示例提问，再决定是否接入对应能力。"
            }
          />
        ) : null}

        <Flex gap={8} wrap>
          <Tag color="green">v{installedSummary?.version ?? "preview"}</Tag>
          <Tag>
            {getSkillAuthorLabel(
              installedSummary?.author,
              installedSummary?.sourceType ?? "runtime",
            )}
          </Tag>
          <Tag color="gold">
            {getSkillCategoryLabel(
              installedSummary?.category,
              installedSummary?.sourceType ?? "runtime",
            )}
          </Tag>
          {installedSummary?.sourceLabel ? (
            <Tag color={installedSummary.sourceType === "bundled" ? "blue" : "geekblue"}>
              {getSkillSourceLabel(installedSummary.sourceLabel, installedSummary.sourceType)}
            </Tag>
          ) : recognizedSummary ? (
            <Tag color="purple">自动识别</Tag>
          ) : null}
          {installed ? (
            <Tag color={enabled ? "blue" : undefined}>{enabled ? "已启用" : "已关闭"}</Tag>
          ) : ready ? (
            <Tag color="blue">可直接调用</Tag>
          ) : (
            <Tag>待启用</Tag>
          )}
        </Flex>

        <Paragraph>{displaySummary}</Paragraph>

        <Card title="技术概览">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="技能 ID">{selectedSkillId}</Descriptions.Item>
            <Descriptions.Item label="版本">{installedSummary?.version ?? "--"}</Descriptions.Item>
            <Descriptions.Item label="作者">
              {getSkillAuthorLabel(installedSummary?.author, installedSummary?.sourceType)}
            </Descriptions.Item>
            <Descriptions.Item label="分类">
              {getSkillCategoryLabel(installedSummary?.category, installedSummary?.sourceType)}
            </Descriptions.Item>
            {installedSummary ? (
              <Descriptions.Item label="启用状态">
                {installedSummary.enabled ? "启用" : "关闭"}
              </Descriptions.Item>
            ) : null}
            {installedSummary ? (
              <Descriptions.Item label="来源">
                {getSkillSourceLabel(installedSummary.sourceLabel, installedSummary.sourceType)}
              </Descriptions.Item>
            ) : null}
            {recognizedSummary && !installedSummary ? (
              <Descriptions.Item label="来源">自动识别</Descriptions.Item>
            ) : null}
            {installedSummary ? (
              <Descriptions.Item label="Manifest">
                {installedSummary.manifestPath}
              </Descriptions.Item>
            ) : null}
            {installedSummary ? (
              <Descriptions.Item label="本地目录">{installedSummary.directory}</Descriptions.Item>
            ) : null}
          </Descriptions>
        </Card>

        <Card title="状态说明">
          <Text type="secondary">当前页面展示的是本地技能与 runtime 实际识别结果。</Text>
        </Card>
      </Flex>
    </Drawer>
  );
}
