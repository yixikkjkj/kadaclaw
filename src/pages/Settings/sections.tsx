import {
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Flex,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Typography,
} from "antd";
import React from "react";
import {
  type AgentConfig,
  type BrowserConfig,
  type WebSearchConfig,
} from "~/api";

const { Paragraph, Text } = Typography;

export interface AgentFormValues {
  activeProvider: string;
  apiKey: string;
  apiBase: string;
  model: string;
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
  webSearch: WebSearchConfig;
  browser: BrowserConfig;
  loading: boolean;
  onSave: (
    tools: string[],
    webSearch: WebSearchConfig,
    browser: BrowserConfig,
  ) => void;
}

export const EnabledToolsSection = ({
  availableTools,
  enabledTools,
  webSearch,
  browser,
  loading,
  onSave,
}: EnabledToolsSectionProps) => {
  const [selected, setSelected] = React.useState<string[]>(enabledTools);
  const [wsProvider, setWsProvider] = React.useState(
    webSearch.provider ?? "duckduckgo",
  );
  const [tavilyKey, setTavilyKey] = React.useState(
    webSearch.tavilyApiKey ?? "",
  );
  const [cdpPort, setCdpPort] = React.useState(String(browser.cdpPort ?? 9222));

  React.useEffect(() => {
    setSelected(enabledTools);
  }, [enabledTools]);

  React.useEffect(() => {
    setWsProvider(webSearch.provider ?? "duckduckgo");
    setTavilyKey(webSearch.tavilyApiKey ?? "");
  }, [webSearch]);

  React.useEffect(() => {
    setCdpPort(String(browser.cdpPort ?? 9222));
  }, [browser]);

  const showWebSearch = selected.includes("web_search");
  const showBrowser = selected.includes("browse");

  const handleSave = () => {
    onSave(
      selected,
      { provider: wsProvider, tavilyApiKey: tavilyKey || null },
      { ...browser, cdpPort: Number(cdpPort) || 9222 },
    );
  };

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

        {showWebSearch ? (
          <>
            <Divider orientationMargin={0}>Web Search 配置</Divider>
            <Row gutter={[16, 0]}>
              <Col xs={24}>
                <Form.Item label="搜索引擎" style={{ marginBottom: 8 }}>
                  <Radio.Group
                    value={wsProvider}
                    onChange={(e) => setWsProvider(e.target.value as string)}
                  >
                    <Radio value="duckduckgo">DuckDuckGo（免费）</Radio>
                    <Radio value="tavily">Tavily（需 API Key）</Radio>
                  </Radio.Group>
                </Form.Item>
              </Col>
              {wsProvider === "tavily" ? (
                <Col xs={24} md={16}>
                  <Form.Item label="Tavily API Key" style={{ marginBottom: 8 }}>
                    <Input.Password
                      value={tavilyKey}
                      onChange={(e) => setTavilyKey(e.target.value)}
                      placeholder="tvly-..."
                    />
                  </Form.Item>
                </Col>
              ) : null}
            </Row>
          </>
        ) : null}

        {showBrowser ? (
          <>
            <Divider orientationMargin={0}>浏览器配置</Divider>
            <Row gutter={[16, 0]}>
              <Col xs={12} md={6}>
                <Form.Item label="CDP 端口" style={{ marginBottom: 8 }}>
                  <Input
                    type="number"
                    min={1}
                    max={65535}
                    value={cdpPort}
                    onChange={(e) => setCdpPort(e.target.value)}
                    placeholder="9222"
                  />
                </Form.Item>
              </Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 12 }}>
              先在系统中启动 Chrome 并附带{" "}
              <code>--remote-debugging-port={cdpPort}</code>，工具将通过 CDP
              连接。
            </Text>
          </>
        ) : null}

        <div>
          <Button type="primary" loading={loading} onClick={handleSave}>
            保存工具配置
          </Button>
        </div>
      </Flex>
    </Card>
  );
};
