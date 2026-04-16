import { Navigate, createHashRouter, useRouteError } from "react-router";
import { ROUTE_PATHS } from "~/common/constants";
import { RouteStatusCard } from "~/components";
import { getErrorMessage } from "~/common/utils";
import { MainLayout } from "~/layouts/MainLayout";
import { ChatPage } from "~/pages/Chat";
import { SettingsPage } from "~/pages/Settings";
import { SkillsPage } from "~/pages/Skills";

const RouteErrorElement = () => {
  const error = useRouteError();

  return (
    <RouteStatusCard
      mode="error"
      title="当前页面加载失败"
      message={getErrorMessage(error, "页面模块加载失败，请刷新后重试")}
    />
  );
};

export const router = createHashRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      {
        errorElement: <RouteErrorElement />,
        children: [
          {
            index: true,
            element: <Navigate to={ROUTE_PATHS.skills} replace />,
          },
          {
            path: ROUTE_PATHS.chat.slice(1),
            element: <ChatPage />,
          },
          {
            path: ROUTE_PATHS.skills.slice(1),
            element: <SkillsPage />,
          },
          {
            path: ROUTE_PATHS.installed.slice(1),
            element: <Navigate to={ROUTE_PATHS.skills} replace />,
          },
          {
            path: ROUTE_PATHS.settings.slice(1),
            element: <SettingsPage />,
          },
          {
            path: "*",
            element: <Navigate to={ROUTE_PATHS.skills} replace />,
          },
        ],
      },
    ],
  },
]);
