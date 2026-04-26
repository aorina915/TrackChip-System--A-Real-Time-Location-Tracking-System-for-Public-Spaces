import Navbar from "../components/Navbar";
import DashboardCard from "../components/DashboardCard";
import Chart from "../components/Chart";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      <Navbar />

      <div className="p-4 md:p-6 grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">

        <DashboardCard title="Active Devices" value="24" color="text-primary" />
        <DashboardCard title="Alerts" value="5" color="text-red-500" />
        <DashboardCard title="Status" value="Online" color="text-green-400" />

        {/* Chart spans full width */}
        <div className="md:col-span-2 xl:col-span-3">
          <Chart />
        </div>

      </div>
    </div>
  );
}