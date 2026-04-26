import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { name: "Mon", value: 10 },
  { name: "Tue", value: 20 },
  { name: "Wed", value: 15 },
  { name: "Thu", value: 30 },
  { name: "Fri", value: 25 },
];

export default function Chart() {
  return (
    <div className="card">
      <h2 className="card-header">Device Activity</h2>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis dataKey="name" stroke="#aaa" />
          <YAxis stroke="#aaa" />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#00ffff" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}