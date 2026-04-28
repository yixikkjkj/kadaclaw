import {
  Button,
  Card,
  Flex,
  Input,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from "antd";
import React from "react";
import {
  getMcpServerStatus,
  restartMcpServer,
  type McpServerConfig,
} from "~/api";

const { Text } = Typography;
const { TextArea } = Input;

const SERVER_ID_RE = /^[a-zA-Z0-9-]+$/;

function validateServerConfig(id: string, jsonStr: string): string | null {
  if (!id.trim()) return "Server ID 不能为空";
  if (!SERVER_ID_RE.test(id.trim()))
    return "Server ID 只允许字母、数字、连字符";
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return "JSON 格式不合法";
  }
  if (typeof parsed !== "object" || parsed === null) return "必须是 JSON 对象";
  const obj = parsed as Record<string, unknown>;
  if (obj["type"] !== "stdio" && obj["type"] !== "http")
    return 'type 必须为 "stdio" 或 "http"';
  if (obj["type"] === "stdio" && !obj["command"])
    return "stdio 类型必须填写 command";
  if (obj["type"] === "http") {
    const url = String(obj["url"] ?? "");
    if (!url.startsWith("http://") && !url.startsWith("https://"))
      return "http 类型 url 必须是合法 http/https 地址";
  }
  if (
    typeof obj["enabled"] !== "undefined" &&
    typeof obj["enabled"] !== "boolean"
  )
    return "enabled 必须是 boolean";
  return null;
}

const DEFAULT_STDIO_JSON = JSON.stringify(
  {
    type: "stdio",
    command: "npx",
    args: [],
    env: {},
    enabled: true,
    startupTimeoutSecs: 30,
    callTimeoutSecs: 60,
  },
  null,
  2,
);

interface McpServerRowProps {
  serverId: string;
  configJson: string;
  status: boolean | undefined;
  onUpdate: (id: string, json: string) => void;
  onDelete: (id: string) => void;
  onRestart: (id: string) => void;
}

const McpServerRow = ({
  serverId,
  configJson,
  status,
  onUpdate,
  onDelete,
  onRestart,
}: McpServerRowProps) => {
  const [editingJson, setEditingJson] = React.useState(configJson);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setEditingJson(configJson);
  }, [configJson]);

  const handleSave = () => {
    const err = validateServerConfig(serverId, editingJson);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onUpdate(serverId, editingJson);
  };

  return (
    <Flex
      vertical
      gap={8}
      style={{
        borderBottom: "1px solid var(--ant-color-border)",
        paddingBottom: 16,
      }}
    >
      <Flex align="center" gap={8}>
        <Text strong>{serverId}</Text>
        {status === true ? (
          <Tag color="success">运行中</Tag>
        ) : status === false ? (
          <Tag color="error">已停止</Tag>
        ) : (
          <Tag>未知</Tag>
        )}
        <div style={{ flex: 1 }} />
        <Space>
          <Button size="small" onClick={() => onRestart(serverId)}>
            重启
          </Button>
          <Popconfirm
            title="确认删除此 MCP Server？"
            onConfirm={() => onDelete(serverId)}
          >
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      </Flex>
      <TextArea
        value={editingJson}
        onChange={(e) => {
          setEditingJson(e.target.value);
          setError(null);
        }}
        rows={6}
        style={{ fontFamily: "monospace", fontSize: 12 }}
      />
      {error ? <Text type="danger">{error}</Text> : null}
      <div>
        <Button size="small" type="primary" onClick={handleSave}>
          保存此条
        </Button>
      </div>
    </Flex>
  );
};

interface AddServerFormProps {
  existingIds: string[];
  onAdd: (id: string, json: string) => void;
  onCancel: () => void;
}

const AddServerForm = ({
  existingIds,
  onAdd,
  onCancel,
}: AddServerFormProps) => {
  const [newId, setNewId] = React.useState("");
  const [newJson, setNewJson] = React.useState(DEFAULT_STDIO_JSON);
  const [error, setError] = React.useState<string | null>(null);

  const handleAdd = () => {
    if (existingIds.includes(newId.trim())) {
      setError(`Server ID "${newId.trim()}" 已存在`);
      return;
    }
    const err = validateServerConfig(newId, newJson);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onAdd(newId.trim(), newJson);
  };

  return (
    <Flex
      vertical
      gap={8}
      style={{
        border: "1px dashed var(--ant-color-primary)",
        borderRadius: 8,
        padding: 12,
      }}
    >
      <Input
        placeholder="Server ID（如 filesystem, brave-search）"
        value={newId}
        onChange={(e) => {
          setNewId(e.target.value);
          setError(null);
        }}
      />
      <TextArea
        value={newJson}
        onChange={(e) => {
          setNewJson(e.target.value);
          setError(null);
        }}
        rows={7}
        style={{ fontFamily: "monospace", fontSize: 12 }}
      />
      {error ? <Text type="danger">{error}</Text> : null}
      <Space>
        <Button type="primary" size="small" onClick={handleAdd}>
          添加
        </Button>
        <Button size="small" onClick={onCancel}>
          取消
        </Button>
      </Space>
    </Flex>
  );
};

export interface McpServersSectionProps {
  mcpServers: Record<string, McpServerConfig>;
  onChange: (servers: Record<string, McpServerConfig>) => void;
}

export const McpServersSection = ({
  mcpServers,
  onChange,
}: McpServersSectionProps) => {
  const [statuses, setStatuses] = React.useState<Record<string, boolean>>({});
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    getMcpServerStatus()
      .then(setStatuses)
      .catch(() => {
        /* non-fatal */
      });
  }, []);

  const handleUpdate = (id: string, json: string) => {
    const parsed = JSON.parse(json) as McpServerConfig;
    onChange({ ...mcpServers, [id]: parsed });
  };

  const handleDelete = (id: string) => {
    const next = { ...mcpServers };
    delete next[id];
    onChange(next);
  };

  const handleRestart = async (id: string) => {
    try {
      await restartMcpServer(id);
      const updated = await getMcpServerStatus();
      setStatuses(updated);
    } catch {
      // non-fatal
    }
  };

  const handleAdd = (id: string, json: string) => {
    const parsed = JSON.parse(json) as McpServerConfig;
    onChange({ ...mcpServers, [id]: parsed });
    setAdding(false);
  };

  const serverEntries = Object.entries(mcpServers);

  return (
    <Card
      title="MCP 服务器"
      extra={
        <Button
          size="small"
          type="primary"
          onClick={() => setAdding(true)}
          disabled={adding}
        >
          + 添加 Server
        </Button>
      }
    >
      <Flex vertical gap={16}>
        {serverEntries.length === 0 && !adding ? (
          <Text type="secondary">
            暂无已配置的 MCP Server。点击「+ 添加 Server」新增。
          </Text>
        ) : null}
        {serverEntries.map(([id, cfg]) => (
          <McpServerRow
            key={id}
            serverId={id}
            configJson={JSON.stringify(cfg, null, 2)}
            status={statuses[id]}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onRestart={(sid) => void handleRestart(sid)}
          />
        ))}
        {adding ? (
          <AddServerForm
            existingIds={serverEntries.map(([id]) => id)}
            onAdd={handleAdd}
            onCancel={() => setAdding(false)}
          />
        ) : null}
      </Flex>
    </Card>
  );
};
