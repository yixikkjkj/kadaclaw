import { useEffect, useRef, useState } from "react";
import { RouterProvider } from "react-router";
import { ROUTE_PATHS } from "~/common/constants";
import { router } from "~/common/router";
import { BootstrappingScreen, OnboardingModal } from "~/components";
import { getAgentConfig } from "~/api";
import { useChatStore, useRuntimeStore, useSkillStore } from "~/store";

const ONBOARDING_STORAGE_KEY = "kadaclaw:onboarding-completed:v1";

const readOnboardingCompleted = () => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const writeOnboardingCompleted = (value: boolean) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (value) {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
      return;
    }

    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {}
};

export const AppRoot = () => {
  const setRuntimeState = useRuntimeStore((state) => state.setRuntimeState);
  const updateAgentConfigured = useRuntimeStore(
    (state) => state.setAgentConfigured,
  );
  const agentConfigured = useRuntimeStore((state) => state.agentConfigured);
  const refreshInstalledSkills = useSkillStore(
    (state) => state.refreshInstalledSkills,
  );
  const hydrateChatHistory = useChatStore((state) => state.hydrateChatHistory);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(
    readOnboardingCompleted,
  );
  const [onboardingDeferredForSession, setOnboardingDeferredForSession] =
    useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const bootstrapStartedRef = useRef(false);

  useEffect(() => {
    void hydrateChatHistory();
  }, [hydrateChatHistory]);

  useEffect(() => {
    if (bootstrapStartedRef.current) {
      return;
    }
    bootstrapStartedRef.current = true;

    void (async () => {
      try {
        const config = await getAgentConfig();
        const hasProvider = Object.values(config.providers).some(
          (p) => p.apiKey,
        );
        updateAgentConfigured(hasProvider);
        setRuntimeState("ready", "Agent 后端已就绪");
      } catch {
        updateAgentConfigured(false);
        setRuntimeState("error", "读取 Agent 配置失败");
      }

      try {
        await refreshInstalledSkills();
      } catch {
        // non-fatal
      }

      setBootstrapping(false);
    })();
  }, [refreshInstalledSkills, setRuntimeState]);

  useEffect(() => {
    if (bootstrapping) {
      return;
    }

    if (onboardingCompleted || onboardingDeferredForSession) {
      setShowOnboarding(false);
      return;
    }

    setShowOnboarding(!agentConfigured);
  }, [
    agentConfigured,
    bootstrapping,
    onboardingCompleted,
    onboardingDeferredForSession,
  ]);

  const completeOnboarding = () => {
    writeOnboardingCompleted(true);
    setOnboardingCompleted(true);
    setShowOnboarding(false);
  };

  const deferOnboarding = () => {
    setOnboardingDeferredForSession(true);
    setShowOnboarding(false);
  };

  const shouldRenderRouter = !bootstrapping || showOnboarding;

  return (
    <>
      {shouldRenderRouter ? <RouterProvider router={router} /> : null}
      {bootstrapping ? <BootstrappingScreen /> : null}
      <OnboardingModal
        open={showOnboarding}
        onFinish={() => {
          completeOnboarding();
          void router.navigate(ROUTE_PATHS.settings);
        }}
        onSkip={deferOnboarding}
      />
    </>
  );
};
