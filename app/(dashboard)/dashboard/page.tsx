export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#1d4838] mt-0 mb-3">Welcome</h2>
      <p className="text-[#666660] m-0">
        Feedback CRM is ready. Add feedback entities under{' '}
        <code className="text-sm bg-[#f4f2ed] px-1 rounded">lib/db/schema</code>, features under{' '}
        <code className="text-sm bg-[#f4f2ed] px-1 rounded">components/features</code>, and business
        logic in <code className="text-sm bg-[#f4f2ed] px-1 rounded">lib/services</code>.
      </p>
    </div>
  );
}
