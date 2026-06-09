export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-bg-border border-t-accent-blue rounded-full animate-spin" />
    </div>
  );
}
