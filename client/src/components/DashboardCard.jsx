export default function DashboardCard({ title, value, color }) {
  return (
    <div className="card">
      <h2 className="card-header">{title}</h2>
      <p className={`text-3xl ${color}`}>{value}</p>
    </div>
  );
}