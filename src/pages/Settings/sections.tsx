import {
  Button,
  Card,
  Checkbox,
  Col,
  Flex,
  Form,
  Input,
  Row,
  Select,
  Typography,
} from "antd";
import React from "react";
import { type AgentConfig } from "~/api";

const { Paragraph, Text } = Typography;
const { TextArea } = Input;

export interface AgentFormValues {
  activeProvider: string;
  apiKey: string;
  apiBase: string;
  model: string;
  systemPrompt: string;
  maxToolRounds: number;
}

export interface ProviderSectionProps {
  config: AgentConfig | null;
  loading: boolean;
  onSave: (values: AgentFormValues) => void;
}

const PROVIDER_OPTIONS = [
  { label: "OpenAI", value: "openai" },
  { label: "Anthropic", value: "anthropic" },
  { label: "DeepSeek", value: "deepseek" },
  { label: "Ollama (本地)", value: "ollama" },
  { label: "Custom / 其他", value: "custom" },
];

export const ProviderSection = ({
  config,
  loading,
  onSave,
}: ProviderSectionProps) => {
  const [form] = Form.useForm<AgentFormValues>();

  const handleSave = async () => {
    const values = await form.validateFields();
    onSave(values);
  };

  const activeProvider = config?.activeProvider ?? "openai";
  const providerConfig = config?.providers[activeProvider];

  return (
    <Card title="LLM 提供商配置">
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          activeProvider,
          apiKey: "",
          apiBase: providerConfig?.apiBase ?? "",
          model: providerConfig?.model ?? "",
          systemPrompt: config?.systemPrompt ?? "",
          maxToolRounds: config?.maxToolRounds ?? 10,
        }}
      >
        <Row gutter={[16, 0]}>
          <Col xs={24} md={8}>
            <Form.Item
              label="Provider"
              name="activeProvider"
              rules={[{ required: true }]}
            >
              <Select options={PROVIDER_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={24} md={16}>
            <Form.Item label="模型" name="model" rules={[{ required: true }]}>
              <Input placeholder="gpt-4o / claude-sonnet-4-5 / deepseek-chat" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item label="API Key" name="apiKey">
              <Input.Password placeholder="留空则保留当前已保存的 key" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              label="API Base URL（可选，留空使用默认）"
              name="apiBase"
            >
              <Input placeholder="https://api.openai.com/v1" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item label="系统 Prompt" name="systemPrompt">
              <TextArea rows={4} placeholder="你是一个有帮助的助理。" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="最大工具调用轮次" name="maxToolRounds">
              <Input type="number" min={1} max={50} />
            </Form.Item>
          </Col>
        </Row>
        <Button
          type="primary"
          loading={loading}
          onClick={() => void handleSave()}
        >
          保存配置
        </Button>
      </Form>
      {config ? (
        <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          当前已配置 provider：
          {Object.keys(config.providers).join("、") || "无"}。
          {providerConfig?.apiKey ? " API Key 已设置。" : " API Key 尚未配置。"}
        </Paragraph>
      ) : null}
    </Card>
  );
};

export interface EnabledToolsSectionProps {
  availableTools: string[];
  enabledTools: string[];
  loading: boolean;
  onSave: (tools: string[]) => void;
}

export const EnabledToolsSection = ({
  availableTools,
  enabledTools,
  loading,
  onSave,
}: EnabledToolsSectionProps) => {
  const [selected, setSelected] = React.useState<string[]>(enabledTools);

  React.useEffect(() => {
    setSelected(enabledTools);
  }, [enabledTools]);

  return (
    <Card title="启用的工具">
      <Flex vertical gap={12}>
        <Text type="secondary">
          选择 Agent 可以使用的工具。未勾选的工具不会出现在 LLM 的工具列表中。
        </Text>
        <Checkbox.Group
          options={availableTools.map((t) => ({ label: t, value: t }))}
          value={selected}
          onChange={(vals) => setSelected(vals as string[])}
        />
        <div>
          <Button
            type="primary"
            loading={loading}
            onClick={() => onSave(selected)}
          >
            保存工具配置
          </Button>
        </div>
      </Flex>
    </Card>
  );
};
