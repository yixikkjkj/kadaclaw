import { Layout } from "antd";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { AppHeaderBar } from "./components/AppHeaderBar";
import { AppSidebar } from "./components/AppSidebar";
import { BootstrappingScreen } from "./components/BootstrappingScreen";
import { OnboardingModal } from "./components/OnboardingModal";
import {
  ensureOpenClawRuntime,
  installBundledOpenClawRuntime,
  launchOpenClawRuntime,
} from "./lib/openclaw";
import { listInstalledSkills, listRecognizedSkills } from "./lib/skills";
import { type AppView, useAppStore } from "./store/appStore";

const { Header, Content } = Layout;
const WorkspacePage = lazy(async () => import("./pages/WorkspacePage").then((module) => ({ default: module.WorkspacePage })));
const MarketPage = lazy(async () => import("./pages/MarketPage").then((module) => ({ default: module.MarketPage })));
const InstalledPage = lazy(async () => import("./pages/InstalledPage").then((module) => ({ default: module.InstalledPage })));
const SettingsPage = lazy(async () => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const SkillDetailDrawer = lazy(async () =>
  import("./components/SkillDetailDrawer").then((module) => ({ default: module.SkillDetailDrawer })),
);

function getErrorMessage(reason: unknown, fallback: string) {
  if (reason instanceof Error && reason.message.trim()) {
    return reason.message.trim();
  }
  if (typeof reason === "string" && reason.trim()) {
    return reason.trim();
  }
  return fallback;
}

function renderView(view: AppView) {
  switch (view) {
    case "workspace":
      return <WorkspacePage />;
    case "market":
      return <MarketPage />;
    case "installed":
      return <InstalledPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return null;
  }
}

export default function App() {
  const currentView = useAppStore((state) => state.currentView);
  const runtimeMessage = useAppStore((state) => state.runtimeMessage);
  const runtimeStatus = useAppStore((state) => state.runtimeStatus);
  const setView = useAppStore((state) => state.setView);
  const setRuntimeState = useAppStore((state) => state.setRuntimeState);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const bootstrapStartedRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<unknown> | null>(null);

  const syncSkills = async (runtimeReachable: boolean, statusMessage: string) => {
    try {
      const [installedSkills, recognizedSkills] = await Promise.all([
        listInstalledSkills(),
        listRecognizedSkills(),
      ]);
      useAppStore.getState().setInstalledSkillIds(installedSkills.map((item) => item.id));
      useAppStore.getState().setRecognizedSkills(
        recognizedSkills.map((item) => item.name),
        recognizedSkills.filter((item) => item.eligible).map((item) => item.name),
      );
    } catch (reason) {
      if (runtimeReachable) {
        setRuntimeState(
          "ready",
          `${statusMessage}，但技能状态同步失败：${getErrorMessage(reason, "未知错误")}`,
        );
      }
    }
  };

  const refreshRuntime = async () => {
    if (refreshPromiseRef.current) {
      await refreshPromiseRef.current;
      return null;
    }

    const task = (async () => {
      try {
        setRuntimeState("checking", "正在初始化 OpenClaw runtime");
        const status = await ensureOpenClawRuntime();
        setRuntimeState(status.reachable ? "ready" : "error", status.message);
        setShowOnboarding(!status.reachable);
        setBootstrapping(false);
        void syncSkills(status.reachable, status.message);

        return status;
      } catch (reason) {
        setRuntimeState(
          "error",
          getErrorMessage(reason, "尚未检测到 OpenClaw runtime，请完成首次安装"),
        );
        setShowOnboarding(true);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = task;
    return await task;
  };

  useEffect(() => {
    if (bootstrapStartedRef.current) {
      return;
    }
    bootstrapStartedRef.current = true;
    void refreshRuntime();
  }, [setRuntimeState]);

  const runOnboardingInstall = async () => {
    if (onboardingLoading) {
      return;
    }
    setOnboardingLoading(true);
    setRuntimeState("checking", "正在安装内置 OpenClaw runtime");
    try {
      await installBundledOpenClawRuntime();
      setRuntimeState("checking", "OpenClaw 已安装，正在启动 runtime");
      await launchOpenClawRuntime();
      await refreshRuntime();
    } catch (reason) {
      setRuntimeState(
        "error",
        `安装或启动失败：${getErrorMessage(reason, "未知错误")}`,
      );
      setShowOnboarding(true);
    } finally {
      setOnboardingLoading(false);
    }
  };

  const runOnboardingStart = async () => {
    if (onboardingLoading) {
      return;
    }
    setOnboardingLoading(true);
    setRuntimeState("checking", "正在启动 OpenClaw runtime");
    try {
      await launchOpenClawRuntime();
      await refreshRuntime();
    } catch (reason) {
      setRuntimeState(
        "error",
        `启动失败：${getErrorMessage(reason, "未知错误")}`,
      );
      setShowOnboarding(true);
    } finally {
      setOnboardingLoading(false);
    }
  };

  return (
    <>
      <OnboardingModal
        open={showOnboarding}
        runtimeStatus={runtimeStatus}
        runtimeMessage={runtimeMessage}
        loading={onboardingLoading}
        onInstall={() => void runOnboardingInstall()}
        onStart={() => void runOnboardingStart()}
        onAdvanced={() => setView("settings")}
      />

      <Layout className="app-shell">
        <AppSidebar currentView={currentView} />
        <Layout>
          <Header className="app-header">
            <AppHeaderBar />
          </Header>
          <Content className="app-content">
            {bootstrapping ? (
              <BootstrappingScreen
                runtimeMessage={runtimeMessage}
                runtimeStatus={runtimeStatus}
              />
            ) : (
              <Suspense
                fallback={
                  <BootstrappingScreen
                    runtimeMessage="正在加载当前页面"
                    runtimeStatus="checking"
                  />
                }
              >
                {renderView(currentView)}
              </Suspense>
            )}
          </Content>
        </Layout>
      </Layout>

      <Suspense fallback={null}>
        <SkillDetailDrawer />
      </Suspense>
    </>
  );
}
