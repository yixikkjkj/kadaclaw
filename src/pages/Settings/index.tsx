import { Flex, message } from "antd";
import { useEffect, useState } from "react";
import {
  getAgentConfig,
  listAvailableTools,
  saveAgentConfig,
  type AgentConfig,
} from "~/api";
import { useRuntimeStore, useSkillStore } from "~/store";
import {
  type AgentFormValues,
  EnabledToolsSection,
  ProviderSection,
} from "./sections";

export const SettingsPage = () => {
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const setRuntimeState = useRuntimeStore((state) => state.setRuntimeState);
  const setAgentConfigured = useRuntimeStore(
    (state) => state.setAgentConfigured,
  );
  const refreshInstalledSkills = useSkillStore(
    (state) => state.refreshInstalledSkills,
  );

  useEffect(() => {
    void (async () => {
      try {
        const config = await getAgentConfig();
        setAgentConfig(config);
      } catch (error) {
        void message.error(`读取 Agent 配置失败: ${String(error)}`);
      }

      try {
        const tools = await listAvailableTools();
        setAvailableTools(tools);
      } catch {
        // non-fatal
      }
    })();
  }, []);

  const saveProvider = async (values: AgentFormValues) => {
    if (!agentConfig) return;
    setLoading(true);
    try {
      const prevProvider = agentConfig.providers[values.activeProvider] ?? {
        model: values.model,
      };
      const nextConfig: AgentConfig = {
        ...agentConfig,
        activeProvider: values.activeProvider,
        systemPrompt: values.systemPrompt,
        maxToolRounds: Number(values.maxToolRounds),
        providers: {
          ...agentConfig.providers,
          [values.activeProvider]: {
            ...prevProvider,
            model: values.model,
            apiBase: values.apiBase || null,
            apiKey: values.apiKey || prevProvider.apiKey || null,
          },
        },
      };
      const saved = await saveAgentConfig(nextConfig);
      setAgentConfig(saved);
      const configured = Object.values(saved.providers).some((p) => p.apiKey);
      setAgentConfigured(configured);
      setRuntimeState(
        configured ? "ready" : "error",
        configured ? "Agent 已就绪" : "API Key 尚未配置",
      );
      void message.success("配置已保存");
    } catch (error) {
      void message.error(`保存配置失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const saveTools = async (tools: string[]) => {
    if (!agentConfig) return;
    setLoading(true);
    try {
      const nextConfig: AgentConfig = { ...agentConfig, enabledTools: tools };
      const saved = await saveAgentConfig(nextConfig);
      setAgentConfig(saved);
      void message.success("工具配置已保存");
    } catch (error) {
      void message.error(`保存工具配置失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex vertical gap={20}>
      <ProviderSection
        config={agentConfig}
        loading={loading}
        onSave={(v) => void saveProvider(v)}
      />
      {availableTools.length > 0 ? (
        <EnabledToolsSection
          availableTools={availableTools}
          enabledTools={agentConfig?.enabledTools ?? []}
          loading={loading}
          onSave={(tools) => void saveTools(tools)}
        />
      ) : null}
    </Flex>
  );
};
