export default function ProtectedRoute({ token, children }) {
  if (!token) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        Unauthorized — Please login
      </div>
    );
  }

  return children;
}