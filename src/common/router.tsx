import { Navigate, createHashRouter, useRouteError } from "react-router";
import { ROUTE_PATHS } from "~/common/constants";
import { RouteStatusCard } from "~/components";
import { getErrorMessage } from "~/common/utils";
import MainLayout from "~/layouts/MainLayout";
import { InstalledPage } from "~/pages/Installed";
import { SettingsPage } from "~/pages/Settings";
import { SkillsPage } from "~/pages/Skills";
import { WorkspacePage } from "~/pages/Workspace";

function RouteErrorElement() {
  const error = useRouteError();

  return (
    <RouteStatusCard
      mode="error"
      title="当前页面加载失败"
      message={getErrorMessage(error, "页面模块加载失败，请刷新后重试")}
    />
  );
}

export const router = createHashRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Navigate to={ROUTE_PATHS.skills} replace />,
      },
      {
        path: ROUTE_PATHS.workspace.slice(1),
        element: <WorkspacePage />,
        errorElement: <RouteErrorElement />,
      },
      {
        path: ROUTE_PATHS.skills.slice(1),
        element: <SkillsPage />,
        errorElement: <RouteErrorElement />,
      },
      {
        path: ROUTE_PATHS.installed.slice(1),
        element: <InstalledPage />,
        errorElement: <RouteErrorElement />,
      },
      {
        path: ROUTE_PATHS.settings.slice(1),
        element: <SettingsPage />,
        errorElement: <RouteErrorElement />,
      },
      {
        path: "*",
        element: <Navigate to={ROUTE_PATHS.skills} replace />,
      },
    ],
  },
]);
