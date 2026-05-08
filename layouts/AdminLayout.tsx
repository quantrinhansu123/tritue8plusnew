import { AppSidebar } from "@/components/Sidebar";
import { SiteHeader } from "@/components/SideHeader";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Suspense } from "@/routes/lazy";
import { Outlet, Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Loader from "@/components/Loader";

export default function AdminLayout() {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();

  // Authentication check
  if (loading) return <Loader />;

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authorization: require admin or teacher
  // Parents are not allowed in workspace
  if (userProfile?.role === "parent") {
    return <Navigate to="/parent-portal" replace />;
  }
  
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as any
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <Suspense>
                  <Outlet />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
