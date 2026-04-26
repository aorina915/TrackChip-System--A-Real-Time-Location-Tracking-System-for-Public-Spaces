export default function Navbar() {
  return (
    <nav className="flex flex-col md:flex-row md:items-center md:justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-md">
      <h1 className="text-xl font-bold text-primary">TrackChip</h1>

      <div className="flex gap-3 mt-3 md:mt-0">
        <button className="btn-secondary">Dashboard</button>
        <button className="btn-secondary">Devices</button>
        <button className="btn-primary">Login</button>
      </div>
    </nav>
  );
}